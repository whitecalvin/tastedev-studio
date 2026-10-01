'use client';
import {useI18n} from '@/i18n/react';
import {useCore} from './context';
import type {TeamAction} from './access';
const actionLabels:Record<TeamAction,string>={read:'Read project',run:'Run tests',cancel:'Cancel runs',ai:'Use AI',approve:'Approve changes','history-write':'Save analysis history','agent-manage':'Manage agents','schedule-manage':'Manage schedules','issue-write':'Create issues',audit:'View audit','access-manage':'Manage team access'};
export function CoreAccessNotice(){
 const {t}=useI18n(),{connection,remote}=useCore(),access=connection.access;
 if(remote&&!connection.connected)return null;
 if(!remote||access?.mode==='local-single-user')return <p className="core-notice">{t("Local single-user mode.")}</p>;
 if(access?.mode!=='team')return null;
 return <section className="core-notice" aria-label={t("Team access")}><strong>{t("Team access")}</strong><dl className="core-fields"><div><dt>{t("Signed in as")}</dt><dd>{access.userId}</dd></div><div><dt>{t("Role")}</dt><dd>{t(access.role)}</dd></div>{access.expiresAt&&<div><dt>{t('Session expires')}</dt><dd>{new Date(access.expiresAt).toLocaleString()}</dd></div>}</dl><details><summary>{t("Permitted actions")}</summary><ul>{access.actions.map(action=><li key={action}>{t(actionLabels[action])}</li>)}</ul></details></section>;
}
