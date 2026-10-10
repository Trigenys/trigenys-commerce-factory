import { useEffect, useRef, useState } from "react";
import type { CartSelection } from "../../shared/commerce-journeys";

type CartState={lines:CartSelection[];settled:string[]};
export function cartLineKey(line:CartSelection):string{return line.productId+JSON.stringify(Object.entries(line.variants).sort(([a],[b])=>a.localeCompare(b)));}
function isCart(value:unknown):value is CartState {
  if(!value||typeof value!=="object")return false;const data=value as CartState;
  return Array.isArray(data.lines)&&data.lines.length<=50&&Array.isArray(data.settled)&&data.settled.every(v=>typeof v==="string")&&data.lines.every(l=>l&&typeof l.productId==="string"&&Number.isInteger(l.quantity)&&l.quantity>=1&&l.quantity<=99&&l.variants&&typeof l.variants==="object"&&!Array.isArray(l.variants)&&Object.entries(l.variants).length<=10&&Object.entries(l.variants).every(([k,v])=>k.length<=80&&typeof v==="string"&&v.length<=80));
}
export function useStoreCart(slug:string,enabled=true){
  const key="commerce-cart:"+slug;
  function read():CartState{try{const stored=JSON.parse(localStorage.getItem(key)||"null");return isCart(stored) ? stored : {lines:[],settled:[]};}catch{return {lines:[],settled:[]};}}
  const[data,setData]=useState<CartState>(()=>enabled ? read() : {lines:[],settled:[]});const[available,setAvailable]=useState(true);const current=useRef(data);
  function change(update:(state:CartState)=>CartState){if(!enabled)return;let previous=current.current;try{const stored=JSON.parse(localStorage.getItem(key)||"null");if(isCart(stored))previous=stored;}catch{setAvailable(false);}const next=update(previous);try{localStorage.setItem(key,JSON.stringify(next));}catch{setAvailable(false);}current.current=next;setData(next);}
  useEffect(()=>{const listener=(event:StorageEvent)=>{if(event.key===key){const next=read();current.current=next;setData(next);}};window.addEventListener("storage",listener);return()=>window.removeEventListener("storage",listener);},[key]);
  return {lines:data.lines,available,count:data.lines.reduce((n,l)=>n+l.quantity,0),
    add(line:CartSelection){let added=true;change(state=>{const target=cartLineKey(line);const prior=state.lines.find(l=>cartLineKey(l)===target);if(!prior && state.lines.length>=50)added=false;return {...state,lines:prior ? state.lines.map(l=>cartLineKey(l)===target ? {...l,quantity:Math.min(99,l.quantity+line.quantity)} : l) : state.lines.length<50 ? [...state.lines,line] : state.lines};});return added;},
    quantity(line:CartSelection,quantity:number){change(state=>({...state,lines:state.lines.map(l=>cartLineKey(l)===cartLineKey(line) ? {...l,quantity:Math.max(1,Math.min(99,quantity))}:l)}));},
    remove(line:CartSelection){change(state=>({...state,lines:state.lines.filter(l=>cartLineKey(l)!==cartLineKey(line))}));},
    complete(requestId:string,submitted:CartSelection[]){change(state=>{if(state.settled.includes(requestId))return state;return {settled:[...state.settled,requestId].slice(-40),lines:state.lines.flatMap(line=>{const ordered=submitted.find(l=>cartLineKey(l)===cartLineKey(line));const quantity=line.quantity-(ordered?.quantity||0);return quantity>0 ? [{...line,quantity}] : [];})};});}
  };
}
export type StoreCart=ReturnType<typeof useStoreCart>;
