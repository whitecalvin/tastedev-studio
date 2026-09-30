import { notFound } from 'next/navigation';
import { TerminalFixture } from './terminal-fixture';
// Development-only component verification. Production returns 404.
export default function TerminalVerification() { if (process.env.NODE_ENV !== 'development') notFound(); return <TerminalFixture />; }
