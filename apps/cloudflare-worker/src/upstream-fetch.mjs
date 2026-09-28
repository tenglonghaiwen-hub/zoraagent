// Workers supports manual/follow only. Never forward credentials to redirects.
export async function fetchWithoutRedirect(fetcher,url,options={}){
 let response;
 try{response=await fetcher(url,{...options,redirect:'manual'});}
 catch(error){
  if(/Invalid redirect value, must be one of/.test(String(error?.message)))error.preSubmission=true;
  throw error;
 }
 if(response.status>=300&&response.status<400)throw Object.assign(Error('上游返回重定向（HTTP '+response.status+'），已拒绝跟随，请核对供应商地址'),{status:502});
 return response;
}
