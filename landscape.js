export function drawLandscape(canvas){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  canvas.width=900;canvas.height=490;
  let seed=4183;const random=()=>((seed=seed*16807%2147483647)/2147483647);
  ctx.fillStyle='#ebdfc6';ctx.fillRect(0,0,900,490);
  ctx.fillStyle='#b76d4f';ctx.beginPath();ctx.arc(680,110,45,0,2*Math.PI);ctx.fill();
  for(let layer=0;layer<4;layer++){
    const y=x=>180+layer*60+Math.sin(x/125+layer)*43+Math.sin(x/48+layer)*13;
    ctx.beginPath();ctx.moveTo(0,490);for(let x=0;x<=900;x+=4)ctx.lineTo(x,y(x)+random()*3);
    ctx.lineTo(900,490);ctx.fillStyle=['#b5bb9d','#87987d','#536e58','#294b3b'][layer];ctx.fill();
    ctx.strokeStyle='#e5d8b6';ctx.lineWidth=1;
    for(let j=0;j<650;j++){const x=random()*900,h=y(x)+4+random()*70;ctx.beginPath();ctx.moveTo(x,h);ctx.lineTo(x+4+random()*13,h-2-random()*5);ctx.stroke()}
  }
  for(let i=0;i<9000;i++){ctx.fillStyle=random()>.5?'#ede1c52b':'#38493318';ctx.fillRect(random()*900,random()*490,random()*3+1,1)}
}
