// Read-only live service diagnostics. Never prints credentials, cookies or database configuration.
import {mkdir,writeFile} from "node:fs/promises";
const api="https://trigenys-commerce-factory-api.lawrynnjennifer.workers.dev";
const report={api,checkedAt:new Date().toISOString(),note:"Read-only anonymous probe; this does not verify sign-up, email delivery or authenticated persistence."};
try{
  const config=await fetch(api+"/v1/config",{signal:AbortSignal.timeout(15000)});report.configStatus=config.status;
  if(config.ok){const body=await config.json();const auth=new URL(body.authBaseUrl);
    if(auth.protocol!=="https:"||!/(?:^|\.)neon\.tech$/.test(auth.hostname))throw new Error("Unexpected authentication provider URL");
    report.authOrigin=auth.origin;report.authPath=auth.pathname;
    for(const path of ["get-session",".well-known/jwks.json"]){const response=await fetch(auth.toString().replace(/\/$/,"")+"/"+path,{headers:{Origin:"https://trigenys-commerce-factory.pages.dev"},signal:AbortSignal.timeout(15000)});report[path]={status:response.status,contentType:response.headers.get("Content-Type"),corsOrigin:response.headers.get("Access-Control-Allow-Origin")};}
  }
}catch(error){report.error=error instanceof Error ? error.message : "Probe unavailable";}
await mkdir("artifacts/journeys",{recursive:true});await writeFile("artifacts/journeys/runtime-diagnostic.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));
