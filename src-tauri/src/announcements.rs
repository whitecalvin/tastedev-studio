use std::{io::Read, time::Duration};
const API: &str = "https://tastedev.net/api/announcements";
const LIMIT: u64 = 512 * 1024;
const LOCALES: [&str; 10] = ["ko","en","de","es","fr","it","pt","ja","zh","zh-hant"];
fn url(locale: &str) -> String {
    let locale=if LOCALES.contains(&locale) {locale} else {"en"};
    format!("{API}?product=tastestudio&locale={locale}")
}
pub fn fetch(locale: &str) -> Result<String,String> {
    let client=reqwest::blocking::Client::builder().timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none()).user_agent(concat!("TASTESTUDIO/",env!("CARGO_PKG_VERSION")))
        .build().map_err(|_|"network")?;
    let response=client.get(url(locale)).send().and_then(|r|r.error_for_status()).map_err(|_|"network")?;
    let mut bytes=Vec::new();response.take(LIMIT+1).read_to_end(&mut bytes).map_err(|_|"network")?;
    if bytes.len() as u64>LIMIT {return Err("too-large".into());}
    String::from_utf8(bytes).map_err(|_|"invalid".into())
}
pub fn open(url: &str) -> Result<(),String> {
    let parsed=reqwest::Url::parse(url).map_err(|_|"invalid")?;
    if parsed.scheme()!="https" || !parsed.username().is_empty() || parsed.password().is_some() || url.len()>2048 {return Err("invalid".into());}
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("rundll32.exe").args(["url.dll,FileProtocolHandler",url])
            .creation_flags(0x0100_0000|0x0800_0000|0x0000_0200).spawn().map_err(|_|"open")?;
    }
    #[cfg(not(windows))] {
        use tastedev_update::Runner;
        tastedev_update::SystemRunner.open(url).map_err(|_|"open")?;
    }
    Ok(())
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn fixed_product_and_validated_locale() {
        assert_eq!(url("ko"),"https://tastedev.net/api/announcements?product=tastestudio&locale=ko");
        assert!(url("en&token=bad").ends_with("locale=en"));
    }
    #[test] fn unsafe_links_never_launch() {for url in ["javascript:alert(1)","http://host/path","https://user:password@host/"] {assert!(open(url).is_err());}}
}
