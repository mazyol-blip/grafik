function rmaATR(h,l,c,n){const N=c.length,out=new Array(N).fill(NaN);let prev=NaN,sum=0;
 for(let i=0;i<N;i++){const tr=i===0?h[i]-l[i]:Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1]));
  if(i<n){sum+=tr;if(i===n-1){prev=sum/n;out[i]=prev;}}else{prev=(prev*(n-1)+tr)/n;out[i]=prev;}}return out;}
function wmaAt(arr,i,len){if(len<1||i-len+1<0)return NaN;let num=0,den=0;for(let k=0;k<len;k++){const v=arr[i-k];if(!isFinite(v))return NaN;const w=len-k;num+=v*w;den+=w;}return num/den;}
function calc72S(o,opt){opt=opt||{};const h=o.h,l=o.l,c=o.c,N=c.length;const minL=172,maxL=233,ap=0.03141,mult=opt.mult||3;
 const a14=rmaATR(h,l,c,14),a46=rmaATR(h,l,c,46),a40=rmaATR(h,l,c,40);
 let dl=(minL+maxL)/2;const len=new Array(N),diff=new Array(N).fill(NaN),hma=new Array(N).fill(NaN);
 for(let i=0;i<N;i++){const plugged=a14[i]>a46[i];dl=plugged?Math.max(minL,dl*(1-ap)):Math.min(maxL,dl*(1+ap));len[i]=Math.trunc(dl);}
 for(let i=0;i<N;i++){const L=len[i];const half=opt.halfFloat?L/2:Math.floor(L/2);diff[i]=2*wmaAt(c,i,Math.floor(half))-wmaAt(c,i,L);}
 // outer wma: length floor(sqrt(L)) applied on diff series (diff computed with each bar's own L)
 for(let i=0;i<N;i++){hma[i]=wmaAt(diff,i,Math.floor(Math.sqrt(len[i])));}
 const r={hma,len,atr40:a40,up:[],lo:[],top:[],bot:[]};
 for(let i=0;i<N;i++){r.up[i]=hma[i]+mult*a40[i];r.lo[i]=hma[i]-mult*a40[i];r.top[i]=hma[i]+2*mult*a40[i];r.bot[i]=hma[i]-2*mult*a40[i];}
 return r;}
if(typeof module!=='undefined')module.exports={calc72S};
