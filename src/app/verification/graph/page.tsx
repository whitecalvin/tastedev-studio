import {notFound} from 'next/navigation';
import {GraphControlFixture} from './fixture';
export default function GraphVerification(){if(process.env.NODE_ENV!=='development')notFound();return <GraphControlFixture/>;}
