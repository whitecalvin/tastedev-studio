import { notFound } from 'next/navigation';
import { GitFixture } from './git-fixture';
export default function GitVerification() { if (process.env.NODE_ENV !== 'development') notFound(); return <GitFixture />; }
