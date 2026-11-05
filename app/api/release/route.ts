import {NextResponse} from 'next/server';
export const dynamic='force-static';
/** Public build identity, deliberately free of environment details or account data. */
export function GET(){
 const gitRevision = process.env.KW_GIT_REVISION;
 return NextResponse.json({
  application: 'kingsworld',
  codeRevision: process.env.KW_CODE_REVISION ?? 'unavailable',
  ...(gitRevision ? {gitRevision} : {}),
 }, {headers: {'Cache-Control': 'no-store'}});
}
