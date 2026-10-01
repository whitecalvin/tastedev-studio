use std::{
    collections::BTreeMap,
    time::{Duration, Instant},
};

/// Results stay durable until Core ACK. A healthy socket is not proof of receipt.
#[derive(Default)]
pub struct DeliveryClock {
    sent: BTreeMap<String, Instant>,
}
impl DeliveryClock {
    pub fn due(&self, execution: &str, now: Instant) -> bool {
        self.sent
            .get(execution)
            .is_none_or(|sent| now.saturating_duration_since(*sent) >= Duration::from_secs(2))
    }
    pub fn sent(&mut self, execution: &str, now: Instant) {
        self.sent.insert(execution.into(), now);
    }
    pub fn acknowledged(&mut self, execution: &str) {
        self.sent.remove(execution);
    }
    pub fn reset(&mut self) {
        self.sent.clear();
    }
}
/// Small bounded jitter prevents multiple Agents reconnecting in lockstep.
pub fn retry_delay(base: u64, maximum: u64, seed: u64) -> Duration {
    let span = (base / 4).max(1);
    Duration::from_millis(base.saturating_add(seed % span).min(maximum))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lost_ack_retries_without_reconnect_and_ack_releases_identity() {
        let mut clock = DeliveryClock::default();
        let now = Instant::now();
        assert!(clock.due("step1", now));
        clock.sent("step1", now);
        assert!(!clock.due("step1", now + Duration::from_millis(1999)));
        assert!(clock.due("step1", now + Duration::from_secs(2)));
        assert!(clock.due("step2", now));
        clock.acknowledged("step1");
        assert!(clock.sent.is_empty());
    }
    #[test]
    fn reconnect_resends_pending_results_without_retaining_old_clock_entries() {
        let mut clock = DeliveryClock::default();
        let now = Instant::now();
        clock.sent("step1", now);
        clock.reset();
        assert!(clock.due("step1", now));
    }
    #[test]
    fn retry_jitter_stays_bounded_even_at_integer_limits() {
        for base in [250, 500, 10000, u64::MAX] {
            for seed in [0, 1, 73, u64::MAX] {
                let delay = retry_delay(base, 10000, seed);
                assert!(delay <= Duration::from_millis(10000));
                assert!(delay >= Duration::from_millis(base.min(10000)));
            }
        }
        assert_ne!(retry_delay(250, 10000, 1), retry_delay(250, 10000, 2));
    }
}
