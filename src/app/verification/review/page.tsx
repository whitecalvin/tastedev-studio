import {notFound} from 'next/navigation';
import {ReviewFixture} from './review-fixture';
export default function ReviewVerification(){if(process.env.NODE_ENV!=='development')notFound();return <ReviewFixture/>;}
