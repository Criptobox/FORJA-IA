/* Imágenes y destinos de Tinta: HTML estático, sin scripts ni HTML de usuario. */
const TintaAssets = (() => {
  const slots={'card.product':'.ph > svg','card.photo':'svg.bgp','card.category':'svg.il','card.food':'svg.pl'};
  function url(value,image=false){
    if(typeof value!=='string')return null;
    const text=value.trim();if(!text)return '';
    if(image&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(text)&&text.length<=750000)return text;
    if(text.length>2048||/[\x00-\x20\x7f]/.test(text))return null;
    if(!image&&/^#[a-zA-Z][\w-]*$/.test(text))return text;
    try{const u=new URL(text);if(!(image?['https:']:['https:','http:','mailto:','tel:']).includes(u.protocol)||u.username||u.password)return null;return u.href;}catch(e){return null;}
  }
  function targets(block){const root=document.createElement('template');root.innerHTML=block.html;const selector=block.id==='c-coffee'?'.media > svg':slots[block.variant];const images=[...root.content.querySelectorAll(selector?selector+', img':'img')].slice(0,40);return {root,images,links:[...root.content.querySelectorAll('button,a')].slice(0,40)};}
  function normalize(raw,catalog){
    const out={};if(raw===undefined)return out;
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Imágenes y destinos no válidos.');
    for(const [id,item] of Object.entries(raw)){
      if(!Object.hasOwn(catalog,id)||!item||typeof item!=='object'||Array.isArray(item))throw Error('El proyecto contiene imágenes de un bloque no disponible.');
      const clean={images:[],links:[]};
      for(const key of ['images','links']){const list=item[key]===undefined?[]:item[key];if(!Array.isArray(list)||list.length>40)throw Error('Demasiadas imágenes o destinos en un bloque.');
        for(const value of list){if(value===null){clean[key].push(null);continue;}
          if(key==='links'){const href=url(value);if(href===null)throw Error('Hay un destino no válido. Usa HTTP(S), mailto, tel o #seccion.');clean.links.push(href||null);}
          else{const src=value&&url(value.src,true);if(!src||typeof value.alt!=='string'||value.alt.length>200)throw Error('Imagen no válida. Usa HTTPS o una foto PNG, JPEG o WebP.');clean.images.push({src,alt:value.alt});}
        }
      }out[id]=clean;
    }
    if(JSON.stringify(out).length>6000000)throw Error('Hay demasiadas fotos incorporadas (máximo 6 MB por pantalla). Quita alguna o usa una URL HTTPS.');
    return out;
  }
  function apply(block,item){if(!item)return block;const parsed=targets(block);let converted=false;
    parsed.images.forEach((node,i)=>{const image=(item.images||[])[i];if(!image||!url(image.src,true))return;const img=document.createElement('img');img.src=image.src;img.alt=image.alt;img.className=node.getAttribute('class')||'';img.setAttribute('data-tinta-image','');img.referrerPolicy='no-referrer';img.loading='lazy';img.style.cssText=(node.getAttribute('style')||'')+';display:block;object-fit:cover;max-width:100%;';if(node.tagName==='IMG')['width','height'].forEach(key=>{if(node.hasAttribute(key))img.setAttribute(key,node.getAttribute(key));});if(block.variant==='card.product')img.style.cssText+='width:100%;height:100%;border-radius:inherit;';if(block.id==='c-coffee')img.style.cssText+='position:absolute;width:100%;height:100%;inset:0;border-radius:inherit;';node.replaceWith(img);});
    parsed.links.forEach((node,i)=>{const href=url((item.links||[])[i]);if(!href)return;let link=node;if(node.tagName==='BUTTON'){link=document.createElement('a');['class','style','aria-label','title'].forEach(key=>{if(node.hasAttribute(key))link.setAttribute(key,node.getAttribute(key));});link.append(...node.childNodes);node.replaceWith(link);converted=true;}link.href=href;link.dataset.tintaLink='';if(/^https?:/.test(href)){link.target='_blank';link.rel='noopener noreferrer';}else{link.removeAttribute('target');link.removeAttribute('rel');}});
    // Mantiene los selectores de los botones originales al convertirlos en enlaces.
    let css=converted?block.css.replace(/\bbutton\b/g,':is(button,a[data-tinta-link])'):block.css;
    css=':where(a[data-tinta-link]){font:inherit;color:inherit}'+css+'a[data-tinta-link]{text-decoration:none;cursor:pointer}';
    return {...block,html:parsed.root.innerHTML,css};
  }
  async function compress(file){
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Elige una foto PNG, JPEG o WebP. No se admite SVG.');
    if(file.size>5*1024*1024)throw Error('La foto supera 5 MB.');
    const objectURL=URL.createObjectURL(file);try{const img=new Image();img.src=objectURL;await img.decode();if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>40000000)throw Error('La foto tiene demasiados píxeles (máximo 40 MP).');const scale=Math.min(1,1024/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#f3f1ed';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);let src=canvas.toDataURL('image/jpeg',.82);if(src.length>750000)src=canvas.toDataURL('image/jpeg',.58);if(src.length>750000)throw Error('La foto comprimida sigue siendo demasiado grande. Usa otra más sencilla.');return src;}catch(e){throw Error(e.message||'No se pudo leer esa foto.');}finally{URL.revokeObjectURL(objectURL);}
  }
  return {url,targets,normalize,apply,compress};
})();
