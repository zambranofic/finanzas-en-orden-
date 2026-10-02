import {buildReviewScenario} from './review-scenario.js';
const KEY='finorve-annual-simulation-v2';
const VERSION='review-year-v2';
if(localStorage.getItem('annual-demo:seed-version')!==VERSION){localStorage.removeItem('annual-demo:finorve-pending-sync');localStorage.setItem('annual-demo:feo-mode','personal');localStorage.setItem('annual-demo:seed-version',VERSION);}
const read=()=>{let data;try{data=JSON.parse(localStorage.getItem(KEY))||buildReviewScenario()}catch{data=buildReviewScenario()}const c=data.records?.business?.collection?.find(x=>x.cashRole==='openingConfig'&&x.currency==='USD'&&x.demo===true);if(c&&c.openingDebtMinor===undefined){c.openingDebtMinor=1200000;c.debtStartDate=c.startDate}return data};
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
