"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function RefreshDomainButton({domainId}:{domainId:string}){const router=useRouter();const [busy,setBusy]=useState(false);return <button disabled={busy} onClick={async()=>{setBusy(true);try{await fetch("/api/domains/refresh",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({domainId})});router.refresh();}finally{setBusy(false);}}}>{busy?"確認中…":"状態を再確認"}</button>}
