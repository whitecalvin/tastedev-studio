use serde_json::Value;
use std::collections::VecDeque;
#[derive(Debug, PartialEq, Eq)]
struct Receipt {
    run: String,
    job: String,
    step: Option<String>,
    sequence: u64,
}
impl Receipt {
    fn parse(value: &Value) -> Option<Self> {
        Some(Self {
            run: value["runId"].as_str()?.into(),
            job: value["jobId"].as_str()?.into(),
            step: value["runStepId"].as_str().map(str::to_owned),
            sequence: value["sequence"].as_u64()?,
        })
    }
    fn same_scope(&self, other: &Self) -> bool {
        self.run == other.run && self.job == other.job && self.step == other.step
    }
}
#[derive(Default)]
pub struct OutputWindow {
    limit: usize,
    pending: VecDeque<Receipt>,
}
impl OutputWindow {
    pub fn configure(&mut self, limit: Option<u64>) -> bool {
        self.pending.clear();
        self.limit = 0;
        match limit {
            None => true,
            Some(n) if (1..=32).contains(&n) => {
                self.limit = n as usize;
                true
            }
            _ => false,
        }
    }
    pub fn drained(&self) -> bool {
        self.pending.is_empty()
    }
    pub fn available(&self) -> bool {
        self.limit == 0 || self.pending.len() < self.limit
    }
    pub fn sent(&mut self, value: &Value) {
        if self.limit > 0 && value["type"] == "output" {
            if let Some(receipt) = Receipt::parse(value) {
                self.pending.push_back(receipt);
            }
        }
    }
    pub fn acknowledge(&mut self, value: &Value) {
        let Some(receipt) = Receipt::parse(value) else {
            return;
        };
        // A different Run/Job/Step or an invented future sequence cannot open
        // the window. Only a receipt for an actually queued event is accepted.
        if !self.pending.front().is_some_and(|p| p.same_scope(&receipt)) {
            return;
        }
        let Some(index) = self.pending.iter().position(|p| p == &receipt) else {
            return;
        };
        if self
            .pending
            .iter()
            .take(index + 1)
            .all(|p| p.same_scope(&receipt))
        {
            self.pending.drain(..=index);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn output(sequence: u64) -> Value {
        json!({"type":"output","runId":"run","jobId":"job","runStepId":"step","sequence":sequence})
    }
    #[test]
    fn window_is_bounded_and_acknowledgements_are_exactly_scoped() {
        let mut w = OutputWindow::default();
        assert!(w.configure(Some(2)));
        w.sent(&output(1));
        w.sent(&output(3));
        assert!(!w.available());
        for field in ["runId", "jobId", "runStepId"] {
            let mut other = output(3);
            other[field] = json!("wrong");
            w.acknowledge(&other);
            assert!(!w.available());
        }
        w.acknowledge(&output(9));
        assert!(!w.available());
        w.acknowledge(&output(1));
        assert!(w.available());
        assert_eq!(w.pending.len(), 1);
        w.acknowledge(&output(1));
        assert_eq!(w.pending.len(), 1);
        w.acknowledge(&output(3));
        assert!(w.pending.is_empty());
    }
    #[test]
    fn legacy_core_and_reconnect_never_leave_an_old_window_blocked() {
        let mut w = OutputWindow::default();
        assert!(!w.configure(Some(33)));
        assert!(!w.configure(Some(0)));
        assert!(w.configure(Some(1)));
        w.sent(&output(1));
        assert!(!w.available());
        assert!(w.configure(None));
        assert!(w.available());
        assert!(w.pending.is_empty());
    }
    #[test]
    fn control_events_never_consume_output_receipts() {
        let mut window = OutputWindow::default();
        assert!(window.configure(Some(1)));
        for kind in ["framework_event", "accepted", "result", "heartbeat"] {
            let mut control = output(1);
            control["type"] = json!(kind);
            window.sent(&control);
            assert!(window.drained());
        }
        window.sent(&output(1));
        assert!(!window.available());
    }
}
