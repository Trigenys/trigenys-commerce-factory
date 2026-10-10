import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { merchantAppHref } from "../merchant-navigation";
import { apiBaseUrl } from "../admin/runtime";
import { timedFetch } from "../lib/requests";
import { preferredLanguage, rememberLanguage } from "../lib/language";
import type { PublicSupportTicket } from "../../shared/commerce-journeys";
import "../admin/admin.css";
import "./public-pages.css";

export function PublicLayout({children,language,onLanguage}: {children:ReactNode;language:"fr"|"en";onLanguage?:(value:"fr"|"en")=>void}) {
  return <div className="info-shell">
    <a className="skip-link" href="#page-main">{language==="fr" ? "Aller au contenu" : "Skip to content"}</a>
    <header className="info-header"><a href="/" aria-label="Commerce Factory"><img src="/commerce-factory-logo-v3.png?v=3" alt="Commerce Factory" /></a>
      <nav aria-label={language==="fr" ? "Navigation" : "Navigation"}><a href="/help">{language==="fr" ? "Aide" : "Help"}</a><a href="/contact">Contact</a><a href={merchantAppHref()}>{language==="fr" ? "Mon espace" : "My workspace"}</a></nav>
      {onLanguage && <div className="admin-language" role="group" aria-label={language==="fr" ? "Langue" : "Language"}>{(["fr","en"] as const).map(value=><button type="button" key={value} aria-pressed={value===language} className={value===language ? "active" : ""} onClick={()=>onLanguage(value)}>{value.toUpperCase()}</button>)}</div>}
    </header>
    <main id="page-main" className="info-content" tabIndex={-1}>{children}</main>
    <footer className="info-footer"><a href="/help">{language==="fr" ? "Aide" : "Help"}</a><a href="/contact">Contact</a><a href="/privacy">{language==="fr" ? "Confidentialité" : "Privacy"}</a><a href="/terms">{language==="fr" ? "Conditions" : "Terms"}</a><span>Commerce Factory · Trigenys</span></footer>
  </div>;
}

const help = {
  fr:[
    ["Créer et publier ma boutique","Créez votre compte, renseignez votre activité et votre numéro WhatsApp, puis choisissez votre apparence. Ajoutez au moins un produit actif avant de publier. Le lien public devient disponible dans votre tableau de bord."],
    ["Modifier mon catalogue","Dans Produits, ajoutez les photos, prix, catégories et variantes. Un brouillon reste privé. Archiver retire un produit du catalogue public sans effacer l’historique des commandes."],
    ["Recevoir une commande","L’acheteur constitue son panier puis enregistre une demande. Les prix sont revérifiés par le serveur. Il ouvre ensuite WhatsApp pour convenir avec vous de la disponibilité, du paiement et de la remise."],
    ["Confirmer un paiement","Dans Commandes, marquez le paiement seulement après l’avoir reçu hors de Commerce Factory. Orange Money, MoMo et espèces sont des modes convenus avec le vendeur ; l’application n’encaisse pas automatiquement."],
    ["Suivre mon achat","Conservez le lien privé affiché après votre demande. Il permet de retrouver son statut sans compte. Un clic WhatsApp seul ne signifie ni paiement ni vente confirmée."],
    ["Rejoindre une équipe","Le propriétaire crée une invitation valable 48 heures, à partager directement avec la personne concernée. Connectez-vous avec l’email invité et vérifiez-le pour accepter. Le collaborateur gère les produits et les commandes ; les réglages, paiements, statistiques et accès restent au propriétaire."],
    ["Reprendre après une coupure","Le panier est conservé sur cet appareil lorsque le stockage est disponible. Les brouillons marchands restent dans l’onglet. Réessayez la demande après une erreur : sa clé de reprise évite une deuxième commande."],
    ["J’ai oublié mon mot de passe","Depuis Connexion, choisissez Mot de passe oublié. Demandez le code par email, collez-le dans le formulaire et choisissez un nouveau mot de passe. Ne communiquez jamais le code à une autre personne."],
    ["Une difficulté ou une demande sur mes données","Utilisez Contact. La réponse du support est consultable via le lien privé remis après l’envoi. Pour une disponibilité, une livraison ou un remboursement, contactez d’abord le vendeur sur WhatsApp."]
  ],
  en:[
    ["Create and publish my store","Create an account, enter your business and WhatsApp number, then choose an appearance. Add at least one active product before publishing. Your public link is available in the dashboard."],
    ["Update my catalog","In Products, add images, prices, categories and variants. Drafts stay private. Archiving removes a product from the public catalog without erasing order history."],
    ["Receive an order","The buyer builds a cart and saves a request. The server rechecks prices. They then open WhatsApp to agree availability, payment and handover with you."],
    ["Confirm a payment","In Orders, confirm payment only after receiving it outside Commerce Factory. Orange Money, MoMo and cash are agreed with the seller; the application does not collect money automatically."],
    ["Track my purchase","Keep the private link displayed after your request. It shows status without an account. A WhatsApp click alone is neither payment nor a confirmed sale."],
    ["Join a team","The owner creates an invitation valid for 48 hours and shares it directly with its recipient. Log in with the invited email and verify it to accept. Staff manage products and orders; settings, payments, analytics and access remain with the owner."],
    ["Resume after a connection failure","The cart stays on this device when storage is available. Merchant drafts stay in the tab. Retry a failed order request: its resume key prevents a duplicate order."],
    ["I forgot my password","Choose Forgot password from Log in. Request an email code, paste it into the form and choose a new password. Never share the code with another person."],
    ["Get help or ask about my data","Use Contact. The support response is available through the private link shown after submission. Ask the seller on WhatsApp first about availability, delivery or refunds."]
  ]
};
const privacy = {
  fr:[
    ["Les données utilisées","Le compte marchand utilise un nom, un email et les données d’authentification gérées par Neon Auth. La boutique contient son identité, ses coordonnées commerciales et son catalogue. Une demande de commande peut contenir un nom, un téléphone et une note si l’acheteur les renseigne."],
    ["Pourquoi nous les utilisons","Ces informations servent à ouvrir l’espace marchand, publier les produits, gérer les accès, transmettre les demandes au vendeur et traiter les demandes d’aide. Les statistiques de consultation comptent des événements de boutique et de produits ; elles ne contiennent pas les messages WhatsApp ni les coordonnées des acheteurs."],
    ["Qui peut les consulter","Le propriétaire et les collaborateurs autorisés voient les commandes de leur boutique. Le support Trigenys voit les demandes d’aide et les métadonnées des boutiques ; sa console n’affiche pas les coordonnées des acheteurs. Cloudflare fournit l’hébergement et les médias, Neon la base et l’authentification. WhatsApp intervient lorsque vous ouvrez la conversation."],
    ["Stockage sur votre appareil","La préférence FR/EN et le panier peuvent être enregistrés dans le stockage du navigateur. Les brouillons marchands utilisent le stockage de l’onglet. Les liens de suivi contiennent une clé privée : gardez-les pour vous. Aucun panier ne constitue une réservation de stock."],
    ["Vos demandes","Pour demander une correction, un export ou la suppression de vos données, utilisez Contact et indiquez le compte ou la référence concernée. Le support vérifie votre identité et la portée de la demande avant d’agir. Ne transmettez jamais de mot de passe ni de code de connexion."],
    ["Conservation","Les données restent disponibles pour le fonctionnement du compte, le traitement des commandes et l’historique du support. Toute demande de suppression est traitée avec les obligations de conservation applicables à la situation. Cette page décrit le fonctionnement du service ; les conditions de WhatsApp et des services de paiement restent distinctes."]
  ],
  en:[
    ["Data we use","Merchant accounts use a name, email and authentication data managed by Neon Auth. Stores contain their identity, business contact details and catalog. Order requests may contain a name, phone number and note if the buyer provides them."],
    ["Why we use it","This data provides merchant access, publishes products, manages permissions, sends requests to sellers and handles support. Visit statistics count store/product events; they do not contain WhatsApp messages or buyers’ contact details."],
    ["Who can see it","Owners and authorized staff see orders in their store. Trigenys support sees support requests and store metadata; its console does not display buyers’ contact details. Cloudflare provides hosting and media, Neon the database and authentication. WhatsApp is involved when you open the conversation."],
    ["Storage on your device","The FR/EN preference and cart may use browser storage. Merchant drafts use tab storage. Tracking links contain a private key: keep them private. A cart does not reserve stock."],
    ["Your requests","Use Contact to request correction, export or deletion of your data, specifying the account or reference. Support verifies your identity and the scope before acting. Never send passwords or login codes."],
    ["Retention","Data remains available for account operation, order handling and support history. Deletion requests are handled with any retention obligations applicable to the situation. This page describes the service; WhatsApp and payment services have separate terms."]
  ]
};
const terms = {
  fr:[
    ["Le service","Commerce Factory, un produit Trigenys, permet aux commerçants de publier un catalogue et de recevoir des demandes via WhatsApp. Le service est en phase de développement et de validation. Les conditions financières d’une éventuelle offre payante sont communiquées avant souscription."],
    ["Compte et accès","Vous fournissez des informations exactes et protégez votre compte. Le propriétaire reste responsable des accès accordés à son équipe. Une invitation ne doit être partagée qu’avec son destinataire. Il est interdit d’accéder aux données d’une autre boutique sans autorisation."],
    ["Catalogue et vente","Le commerçant est responsable de ses produits, visuels, prix, disponibilité et conditions de vente. Une demande enregistrée attend sa confirmation ; elle ne réserve pas le stock. Le vendeur et l’acheteur conviennent directement du paiement et de la remise."],
    ["Paiements et remboursements","Commerce Factory n’encaisse pas automatiquement Orange Money, MoMo ou les espèces. Le marchand indique les paiements et remboursements qu’il a effectivement réalisés ou reçus hors de l’outil. Les litiges liés aux produits, à la livraison ou au remboursement sont d’abord adressés au vendeur."],
    ["Usage autorisé","N’utilisez pas le service pour des produits interdits, des contenus trompeurs ou portant atteinte aux droits d’un tiers. Ne téléversez pas de données personnelles inutiles, de secrets ou de contenus malveillants. Signalez un abus depuis Contact."],
    ["Aide et disponibilité","Une connexion internet et un accès à WhatsApp sont nécessaires aux étapes correspondantes. Des interruptions peuvent survenir ; utilisez les commandes de reprise et les liens privés de suivi. Les demandes sur le service et les données se font depuis Contact."]
  ],
  en:[
    ["The service","Commerce Factory, a Trigenys product, lets merchants publish catalogs and receive WhatsApp requests. It is in development and validation. Financial terms for any paid plan are provided before subscription."],
    ["Account and access","Provide accurate information and protect your account. The owner is responsible for team access. Share invitations only with their recipient. Access to another store’s data without authorization is prohibited."],
    ["Catalog and sales","Merchants are responsible for products, imagery, prices, availability and sales terms. Saved requests await confirmation and do not reserve stock. Seller and buyer agree payment and handover directly."],
    ["Payments and refunds","Commerce Factory does not automatically collect Orange Money, MoMo or cash. Merchants record payments/refunds actually received or made outside the tool. Product, delivery or refund disputes should first be raised with the seller."],
    ["Permitted use","Do not use the service for prohibited products, misleading content or infringement of others’ rights. Do not upload unnecessary personal data, secrets or malicious content. Report abuse through Contact."],
    ["Help and availability","Internet and WhatsApp access are needed for the relevant steps. Interruptions can occur; use retry controls and private tracking links. Contact handles questions about the service and your data."]
  ]
};

function privateToken():string {return [...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,"0")).join("");}
function ContactForm({language}: {language:"fr"|"en"}) {
  const fr=language==="fr";const [name,setName]=useState("");const[email,setEmail]=useState("");const[message,setMessage]=useState("");const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[receipt,setReceipt]=useState("");
  const [request]=useState(()=>({id:crypto.randomUUID(),trackingToken:privateToken()}));
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try {const r=await timedFetch(apiBaseUrl+"/v1/public/support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...request,name,email,message})});if(!r.ok)throw new Error("SUPPORT_FAILED");const body=await r.json() as {ticket:PublicSupportTicket};setReceipt("/help/requests/"+body.ticket.id+"#token="+request.trackingToken);}
    catch {setError(fr ? "L’envoi n’a pas abouti. Votre texte est conservé ; réessayez." : "Submission did not complete. Your text is safe; try again.");}finally{setBusy(false);}
  }
  if(receipt)return <div className="info-card" role="status"><h2>{fr ? "Votre demande est enregistrée" : "Your request is saved"}</h2><p>{fr ? "Conservez ce lien privé pour consulter la réponse du support." : "Keep this private link to read the support reply here."}</p><a className="admin-primary" href={receipt}>{fr ? "Suivre ma demande" : "Track my request"}</a>{error && <p role="alert">{error}</p>}<button type="button" className="admin-secondary" onClick={()=>navigator.clipboard?.writeText(window.location.origin+receipt).catch(()=>setError(fr ? "Ouvrez le suivi puis copiez son adresse." : "Open tracking and copy its address."))}>{fr ? "Copier le lien" : "Copy link"}</button></div>;
  return <form className="admin-form info-card" onSubmit={submit} aria-busy={busy}>
    <label><span>{fr ? "Votre nom" : "Your name"}</span><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength={120} required /></label>
    <label><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" maxLength={254} required /></label>
    <label><span>{fr ? "Votre demande" : "Your request"}</span><textarea value={message} onChange={e=>setMessage(e.target.value)} minLength={10} maxLength={4000} rows={6} required aria-describedby="support-hint" /></label>
    <p id="support-hint">{fr ? "Décrivez le problème et la référence concernée. N’envoyez ni mot de passe ni code. Votre réponse sera disponible via un lien privé." : "Describe the issue and relevant reference. Do not send passwords or codes. Your reply will be available through a private link."} <a href="/privacy">{fr ? "Confidentialité" : "Privacy"}</a></p>
    {error && <p role="alert" className="form-message error">{error}</p>}
    <button type="submit" className="admin-primary" disabled={busy}>{busy ? (fr ? "Envoi…" : "Sending…") : (fr ? "Envoyer ma demande" : "Send request")}</button>
  </form>;
}
function SupportReceipt({language}: {language:"fr"|"en"}) {
  const [ticket,setTicket]=useState<PublicSupportTicket|null>(null);const[busy,setBusy]=useState(true);const[error,setError]=useState("");const fr=language==="fr";
  async function load(){setBusy(true);setError("");try{const id=window.location.pathname.split("/").pop();const secret=new URLSearchParams(window.location.hash.slice(1)).get("token") || "";const r=await timedFetch(apiBaseUrl+"/v1/public/support/"+id,{headers:{"X-Support-Token":secret}});if(!r.ok)throw new Error();setTicket((await r.json()).ticket);}catch{setError(fr ? "Cette demande est inaccessible. Vérifiez le lien privé ou réessayez." : "This request is unavailable. Check your private link or try again.");}finally{setBusy(false);}}
  useEffect(()=>{void load();},[]);
  return <><h1>{fr ? "Suivi de votre demande" : "Track your request"}</h1>{busy && <p role="status">{fr ? "Chargement…" : "Loading…"}</p>}{error && <p role="alert">{error}</p>}{ticket && <div className="info-card"><p>{fr ? "Statut" : "Status"} : <strong>{ticket.status==="open" ? (fr ? "Reçue" : "Received") : ticket.status==="in_progress" ? (fr ? "En cours" : "In progress") : (fr ? "Traitée" : "Resolved")}</strong></p><h2>{fr ? "Réponse du support" : "Support reply"}</h2><p className="preserve-lines">{ticket.reply || (fr ? "Votre demande attend une réponse." : "Your request is awaiting a reply.")}</p></div>}<button type="button" className="admin-secondary" onClick={load} disabled={busy}>{fr ? "Actualiser le statut" : "Refresh status"}</button></>;
}

export default function PublicPages() {
  const [language,setLanguage]=useState(preferredLanguage);const path=window.location.pathname;const fr=language==="fr";
  const type=path==="/privacy" ? "privacy" : path==="/terms" ? "terms" : path==="/contact" ? "contact" : path==="/help" ? "help" : path.startsWith("/help/requests/") ? "receipt" : "404";
  const title=type==="privacy" ? (fr ? "Confidentialité" : "Privacy") : type==="terms" ? (fr ? "Conditions d’utilisation" : "Terms of use") : type==="contact" ? (fr ? "Parlons de votre demande" : "How can we help?") : type==="help" ? (fr ? "L’aide pour avancer" : "Help to move forward") : type==="receipt" ? (fr ? "Suivi de demande" : "Request tracking") : (fr ? "Cette page n’existe pas" : "This page does not exist");
  useEffect(()=>{document.title=title+" — Commerce Factory";document.documentElement.lang=language;rememberLanguage(language);if(type==="404"||type==="receipt"){const meta=document.createElement("meta");meta.name="robots";meta.content="noindex,nofollow";document.head.appendChild(meta);return()=>meta.remove();}},[language,title,type]);
  const sections=type==="privacy" ? privacy[language] : type==="terms" ? terms[language] : help[language];
  return <PublicLayout language={language} onLanguage={setLanguage}><span className="admin-eyebrow">Commerce Factory</span>{type!=="receipt" && <h1>{title}</h1>}
    {type==="404" ? <><p>{fr ? "Le lien peut être incorrect ou la page a été déplacée." : "The link may be incorrect or the page has moved."}</p><a className="admin-primary" href="/">{fr ? "Retour à l’accueil" : "Back home"}</a></> : type==="contact" ? <><p>{fr ? "Pour une commande, contactez le vendeur sur WhatsApp. Pour l’outil, vos accès ou vos données, écrivez au support ici." : "Contact the seller on WhatsApp about an order. For the tool, access or your data, contact support here."}</p><ContactForm language={language} /></> : type==="receipt" ? <SupportReceipt language={language} /> : <>{type!=="help" && <p className="info-date">{fr ? "Version du 10 octobre 2026" : "Version: 10 October 2026"}</p>}<div className="info-sections">{sections.map(([heading,body])=>type==="help" ? <details className="info-card" key={heading}><summary>{heading}</summary><p>{body}</p></details> : <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</div><a className="admin-primary" href="/contact">{fr ? "Contacter le support" : "Contact support"}</a></>}
  </PublicLayout>;
}
