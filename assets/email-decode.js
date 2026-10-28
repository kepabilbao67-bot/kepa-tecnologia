'use strict';
(()=>{
  for(const node of document.querySelectorAll('[data-cfemail]')){
    const value=node.getAttribute('data-cfemail')||'';
    if(!/^(?:[a-f0-9]{2}){2,}$/i.test(value))continue;
    const key=parseInt(value.slice(0,2),16);
    let email='';for(let i=2;i<value.length;i+=2)email+=String.fromCharCode(parseInt(value.slice(i,i+2),16)^key);
    if(!/^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(email))continue;
    node.textContent=email;
    const link=node.closest('a');if(link&&(link.getAttribute('href')||'').startsWith('/cdn-cgi/l/email-protection'))link.href='mailto:'+email;
  }
})();
