import { notFound } from 'next/navigation';
import { CoreFixture } from './core-fixture';
export default function CoreVerification(){if(process.env.NODE_ENV!=='development')notFound();return <CoreFixture/>;}
