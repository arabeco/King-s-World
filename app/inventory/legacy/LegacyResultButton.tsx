"use client";

import {useState} from "react";
import CozyAscensionResult from "@/components/cozy/CozyAscensionResult";
import {CrownButton} from "@/components/cozy/CozyCrownUI";
import {CollectionDialog} from "@/components/profile/CollectionDialog";
import type {CozyAscensionReceipt} from "@/lib/cozy/ascension-preview";

export default function LegacyResultButton({receipt}: {receipt:Pick<CozyAscensionReceipt,
  "worldName"|"medal"|"sovereign"|"sovereignId"|"score"|"peak"|"rewards">}) {
  const [open,setOpen]=useState(false);
  return <>
    <CrownButton onClick={()=>setOpen(true)}>Ver resultado da Travessia</CrownButton>
    {open&&<CollectionDialog title="Resultado da Travessia" onClose={()=>setOpen(false)}>
      <CozyAscensionResult result={receipt} onClose={()=>setOpen(false)}/>
    </CollectionDialog>}
  </>;
}
