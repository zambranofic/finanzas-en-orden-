import {buildAnnualScenario} from './annual-scenario.js';
const KEY='finorve-annual-simulation-v1';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||buildAnnualScenario()}catch{return buildAnnualScenario()}};
export const acceptAuthFromUrl=()=>null;
export const currentUser=async()=>({id:'fictional-annual-simulation',email:''});
export const myLicense=async()=>({status:'active',expires_at:'2099-12-31T05:00:00Z',annual_price_minor:2900,annual_currency:'USD'});
export const isAdmin=async()=>false;
export const loadData=async()=>structuredClone(read());
export async function syncRecords(records,profile){localStorage.setItem(KEY,JSON.stringify({...read(),records,profile}));}
export async function saveProfile(profile){localStorage.setItem(KEY,JSON.stringify({...read(),profile}));}
export const avatarObjectUrl=async()=>'';
export const exportMyData=async()=>read();
const blocked=async()=>{throw new Error('Esta demostración no permite cuentas, pagos ni cambios de seguridad.');};
export const signIn=blocked,signOut=()=>{},changePassword=blocked,deleteMyAccount=blocked,uploadAvatar=blocked,claimPaidAccess=blocked,createPaidAccount=blocked,requestPasswordReset=blocked,resendSignupConfirmation=blocked,createPublicCheckout=blocked,capturePublicCheckout=blocked,cancelPublicCheckout=blocked,paypalPublicConfig=blocked,adminDashboard=blocked,adminOpsSummary=blocked,adminAddNote=blocked,adminSetLicense=blocked;
