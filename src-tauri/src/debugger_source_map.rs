use crate::filesystem::{error, resolve, Result};
use serde_json::Value;
use std::{collections::HashMap, fs, path::Path};
#[derive(Clone)]
struct Point {
    generated_line: u32,
    generated_column: u32,
    path: String,
    line: u32,
    column: u32,
}
pub struct SourceMaps {
    maps: HashMap<String, Vec<Point>>,
    count: usize,
}
fn relative(root: &Path, base: &Path, value: &str) -> Option<String> {
    if value.contains([':', '\0']) || value.starts_with(['/', '\\']) {
        return None;
    }
    let file = base.join(value).canonicalize().ok()?;
    let path = file.strip_prefix(root).ok()?.to_str()?.replace('\\', "/");
    if resolve(root, &path, false).ok()? != file {
        return None;
    }
    Some(path)
}
fn vlq(bytes: &[u8], at: &mut usize) -> Result<i64> {
    let mut value = 0u64;
    let mut shift = 0;
    loop {
        let b = *bytes.get(*at).ok_or_else(|| error("debug-map"))?;
        *at += 1;
        let digit = match b {
            b'A'..=b'Z' => (b - b'A') as u64,
            b'a'..=b'z' => (b - b'a' + 26) as u64,
            b'0'..=b'9' => (b - b'0' + 52) as u64,
            b'+' => 62,
            b'/' => 63,
            _ => return Err(error("debug-map")),
        };
        if shift > 30 {
            return Err(error("debug-map"));
        }
        value |= (digit & 31) << shift;
        shift += 5;
        if digit & 32 == 0 {
            break;
        }
    }
    let magnitude = (value >> 1) as i64;
    Ok(if value & 1 == 1 {
        -magnitude
    } else {
        magnitude
    })
}
fn decode(root: &Path, map: &Path, json: &Value) -> Result<Vec<Point>> {
    if json["version"] != 3 || !json["sections"].is_null() {
        return Err(error("debug-map"));
    }
    let source_root = json["sourceRoot"].as_str().unwrap_or("");
    let sources = json["sources"]
        .as_array()
        .filter(|s| s.len() <= 256)
        .ok_or_else(|| error("debug-map"))?;
    let sources = sources
        .iter()
        .map(|s| {
            relative(
                root,
                map.parent()?,
                &format!("{}/{}", source_root.trim_end_matches('/'), s.as_str()?),
            )
            .or_else(|| {
                if source_root.is_empty() {
                    relative(root, map.parent()?, s.as_str()?)
                } else {
                    None
                }
            })
        })
        .collect::<Vec<_>>();
    let mappings = json["mappings"]
        .as_str()
        .filter(|m| m.len() <= 512 * 1024)
        .ok_or_else(|| error("debug-map"))?;
    let mut source = 0i64;
    let mut line = 0i64;
    let mut column = 0i64;
    let mut name = 0i64;
    let mut points = Vec::new();
    for (generated_line, text) in mappings.split(';').enumerate() {
        if generated_line > 100000 {
            return Err(error("debug-map"));
        }
        let mut generated_column = 0i64;
        for segment in text.split(',').filter(|s| !s.is_empty()) {
            let bytes = segment.as_bytes();
            let mut at = 0;
            generated_column = generated_column
                .checked_add(vlq(bytes, &mut at)?)
                .ok_or_else(|| error("debug-map"))?;
            if !(0..=2000000).contains(&generated_column) {
                return Err(error("debug-map"));
            }
            if at == bytes.len() {
                continue;
            }
            source = source
                .checked_add(vlq(bytes, &mut at)?)
                .ok_or_else(|| error("debug-map"))?;
            line = line
                .checked_add(vlq(bytes, &mut at)?)
                .ok_or_else(|| error("debug-map"))?;
            column = column
                .checked_add(vlq(bytes, &mut at)?)
                .ok_or_else(|| error("debug-map"))?;
            if at < bytes.len() {
                name = name
                    .checked_add(vlq(bytes, &mut at)?)
                    .ok_or_else(|| error("debug-map"))?;
            }
            if at != bytes.len()
                || source < 0
                || !(0..=100000).contains(&line)
                || !(0..=2000000).contains(&column)
                || name < 0
            {
                return Err(error("debug-map"));
            }
            if let Some(Some(path)) = sources.get(source as usize) {
                if !matches!(
                    Path::new(path).extension().and_then(|e| e.to_str()),
                    Some("ts" | "mts" | "cts" | "js" | "mjs" | "cjs")
                ) {
                    continue;
                }
                points.push(Point {
                    generated_line: generated_line as u32,
                    generated_column: generated_column as u32,
                    path: path.clone(),
                    line: line as u32,
                    column: column as u32,
                });
                if points.len() > 20000 {
                    return Err(error("debug-map"));
                }
            } else if source as usize >= sources.len() {
                return Err(error("debug-map"));
            }
        }
    }
    Ok(points)
}
impl SourceMaps {
    pub fn new() -> Self {
        Self {
            maps: HashMap::new(),
            count: 0,
        }
    }
    pub fn load(&mut self, root: &Path, file: &Path) {
        if self.maps.len() >= 64 || self.count >= 100000 {
            return;
        }
        let Some(path) = file
            .strip_prefix(root)
            .ok()
            .and_then(|p| p.to_str())
            .map(|p| p.replace('\\', "/"))
        else {
            return;
        };
        if self.maps.contains_key(&path)
            || fs::metadata(file).is_ok_and(|m| m.len() > 2 * 1024 * 1024)
        {
            return;
        }
        let Ok(text) = fs::read_to_string(file) else {
            return;
        };
        let Some(url) = text.lines().rev().take(8).find_map(|line| {
            line.trim()
                .strip_prefix("//# sourceMappingURL=")
                .map(str::trim)
        }) else {
            return;
        };
        let Some(map_path) = relative(root, file.parent().unwrap_or(root), url) else {
            return;
        };
        let Ok(map) = resolve(root, &map_path, false) else {
            return;
        };
        if !fs::metadata(&map).is_ok_and(|m| m.len() <= 512 * 1024) {
            return;
        }
        let Ok(json) = fs::read_to_string(&map)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .ok_or(())
        else {
            return;
        };
        if let Ok(points) = decode(root, &map, &json) {
            if self.count + points.len() <= 100000 {
                self.count += points.len();
                self.maps.insert(path, points);
            }
        }
    }
    pub fn original(&self, path: &str, line: u32, column: u32) -> Option<(String, u32, u32)> {
        let points = self.maps.get(path)?;
        points
            .iter()
            .filter(|p| p.generated_line == line && p.generated_column <= column)
            .max_by_key(|p| p.generated_column)
            .map(|p| (p.path.clone(), p.line, p.column))
    }
    pub fn generated(&self, path: &str, line: u32) -> Option<(String, u32, u32)> {
        self.maps
            .iter()
            .flat_map(|(file, points)| {
                points
                    .iter()
                    .filter(move |p| p.path == path && p.line == line)
                    .map(move |p| (file.clone(), p.generated_line, p.generated_column))
            })
            .min_by_key(|p| (p.1, p.2))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn source_maps_preserve_original_positions_and_block_remote_escape_and_malformed_vlq() {
        let root=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/fourth-advancement/phase-2/native-map");
        fs::create_dir_all(&root).unwrap();
        let dir = tempfile::tempdir_in(root).unwrap();
        fs::create_dir(dir.path().join("dist")).unwrap();
        fs::create_dir(dir.path().join("src")).unwrap();
        fs::write(dir.path().join("src/main.ts"), "const value:number=1").unwrap();
        let root = dir.path().canonicalize().unwrap();
        let map = root.join("dist/main.js.map");
        fs::write(
            &map,
            json!({"version":3,"sources":["../src/main.ts"],"names":[],"mappings":"AAAA;AACA"})
                .to_string(),
        )
        .unwrap();
        fs::write(
            root.join("dist/main.js"),
            "value=1;\nvalue=2;\n//# sourceMappingURL=main.js.map",
        )
        .unwrap();
        let mut maps = SourceMaps::new();
        maps.load(&root, &root.join("dist/main.js"));
        assert_eq!(
            maps.original("dist/main.js", 1, 3),
            Some(("src/main.ts".into(), 1, 0))
        );
        assert_eq!(
            maps.generated("src/main.ts", 1),
            Some(("dist/main.js".into(), 1, 0))
        );
        assert!(relative(&root, &root, "https://example.test/source").is_none());
        assert!(relative(&root, &root, "../outside.ts").is_none());
        assert!(decode(
            &root,
            &map,
            &json!({"version":3,"sources":["../src/main.ts"],"mappings":"!AAA"})
        )
        .is_err());
    }
}
