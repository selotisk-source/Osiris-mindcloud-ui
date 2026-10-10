export function createRequestInit(init={}){
  const headers=new Headers(init.headers||{});
  if(init.body instanceof FormData){
    headers.delete("content-type");
  }else if(!headers.has("content-type")){
    headers.set("content-type","application/json");
  }
  return {...init,headers};
}
