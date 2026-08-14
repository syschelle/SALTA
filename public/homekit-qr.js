(function(global){
  'use strict';

  const ALPHANUMERIC='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  const SIZE=21;
  const DATA_CODEWORDS=19;
  const ECC_CODEWORDS=7;

  function appendBits(bits,value,count){
    for(let i=count-1;i>=0;i--)bits.push((value>>>i)&1);
  }

  function encodeData(text){
    if(typeof text!=='string'||!/^X-HM:\/\/[0-9A-Z $%*+\-./:]+$/.test(text))throw new Error('HOMEKIT_SETUP_URI_UNSUPPORTED');
    if(text.length>25)throw new Error('HOMEKIT_SETUP_URI_TOO_LONG');
    const bits=[];
    appendBits(bits,0b0010,4); // QR alphanumeric mode
    appendBits(bits,text.length,9); // Version 1 character count
    for(let i=0;i+1<text.length;i+=2){
      const first=ALPHANUMERIC.indexOf(text[i]);
      const second=ALPHANUMERIC.indexOf(text[i+1]);
      if(first<0||second<0)throw new Error('HOMEKIT_SETUP_URI_UNSUPPORTED');
      appendBits(bits,first*45+second,11);
    }
    if(text.length%2===1){
      const last=ALPHANUMERIC.indexOf(text[text.length-1]);
      if(last<0)throw new Error('HOMEKIT_SETUP_URI_UNSUPPORTED');
      appendBits(bits,last,6);
    }
    const capacity=DATA_CODEWORDS*8;
    if(bits.length>capacity)throw new Error('HOMEKIT_SETUP_URI_TOO_LONG');
    appendBits(bits,0,Math.min(4,capacity-bits.length));
    while(bits.length%8!==0)bits.push(0);
    const bytes=[];
    for(let i=0;i<bits.length;i+=8){
      let value=0;
      for(let j=0;j<8;j++)value=(value<<1)|bits[i+j];
      bytes.push(value);
    }
    for(let pad=0;bytes.length<DATA_CODEWORDS;pad++)bytes.push(pad%2===0?0xec:0x11);
    return bytes;
  }

  function gfMultiply(x,y){
    let z=0;
    for(let i=7;i>=0;i--){
      z=(z<<1)^((z>>>7)*0x11d);
      if(((y>>>i)&1)!==0)z^=x;
    }
    return z;
  }

  function rsDivisor(degree){
    const result=new Array(degree).fill(0);
    result[degree-1]=1;
    let root=1;
    for(let i=0;i<degree;i++){
      for(let j=0;j<degree;j++){
        result[j]=gfMultiply(result[j],root);
        if(j+1<degree)result[j]^=result[j+1];
      }
      root=gfMultiply(root,0x02);
    }
    return result;
  }

  function rsRemainder(data,divisor){
    const result=new Array(divisor.length).fill(0);
    for(const byte of data){
      const factor=byte^result[0];
      result.shift();
      result.push(0);
      for(let i=0;i<result.length;i++)result[i]^=gfMultiply(divisor[i],factor);
    }
    return result;
  }

  function formatBits(){
    const data=0b01<<3; // Error correction L, mask 0
    let remainder=data;
    for(let i=0;i<10;i++)remainder=(remainder<<1)^(((remainder>>>9)&1)*0x537);
    return ((data<<10)|remainder)^0x5412;
  }

  function createMatrix(text){
    const data=encodeData(text);
    const codewords=data.concat(rsRemainder(data,rsDivisor(ECC_CODEWORDS)));
    const modules=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
    const isFunction=Array.from({length:SIZE},()=>Array(SIZE).fill(false));

    function setFunction(x,y,dark){
      if(x<0||y<0||x>=SIZE||y>=SIZE)return;
      modules[y][x]=Boolean(dark);
      isFunction[y][x]=true;
    }

    function finder(centerX,centerY){
      for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
        const x=centerX+dx,y=centerY+dy;
        if(x<0||y<0||x>=SIZE||y>=SIZE)continue;
        const distance=Math.max(Math.abs(dx),Math.abs(dy));
        setFunction(x,y,distance!==2&&distance!==4);
      }
    }

    finder(3,3);
    finder(SIZE-4,3);
    finder(3,SIZE-4);

    for(let i=0;i<SIZE;i++){
      if(!isFunction[6][i])setFunction(i,6,i%2===0);
      if(!isFunction[i][6])setFunction(6,i,i%2===0);
    }

    const format=formatBits();
    const bit=i=>((format>>>i)&1)!==0;
    for(let i=0;i<=5;i++)setFunction(8,i,bit(i));
    setFunction(8,7,bit(6));
    setFunction(8,8,bit(7));
    setFunction(7,8,bit(8));
    for(let i=9;i<15;i++)setFunction(14-i,8,bit(i));
    for(let i=0;i<8;i++)setFunction(SIZE-1-i,8,bit(i));
    for(let i=8;i<15;i++)setFunction(8,SIZE-15+i,bit(i));
    setFunction(8,SIZE-8,true);

    let bitIndex=0;
    for(let right=SIZE-1;right>=1;right-=2){
      if(right===6)right--;
      const upward=((right+1)&2)===0;
      for(let vertical=0;vertical<SIZE;vertical++){
        const y=upward?SIZE-1-vertical:vertical;
        for(let j=0;j<2;j++){
          const x=right-j;
          if(isFunction[y][x])continue;
          const sourceBit=bitIndex<codewords.length*8?((codewords[bitIndex>>>3]>>>(7-(bitIndex&7)))&1):0;
          const masked=sourceBit^(((x+y)&1)===0?1:0); // QR mask pattern 0
          modules[y][x]=Boolean(masked);
          bitIndex++;
        }
      }
    }
    if(bitIndex!==codewords.length*8)throw new Error('HOMEKIT_QR_INTERNAL_LAYOUT_ERROR');
    return modules;
  }

  function renderSvg(text){
    const matrix=createMatrix(text);
    const border=4;
    const viewSize=SIZE+border*2;
    let path='';
    for(let y=0;y<SIZE;y++){
      let start=-1;
      for(let x=0;x<=SIZE;x++){
        const dark=x<SIZE&&matrix[y][x];
        if(dark&&start<0)start=x;
        else if(!dark&&start>=0){
          const width=x-start;
          path+=`M${start+border} ${y+border}h${width}v1h-${width}z`;
          start=-1;
        }
      }
    }
    return `<svg class="homekit-pairing-qr-svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${viewSize}" height="${viewSize}" role="img" aria-label="HomeKit Pairing QR-Code" xmlns="http://www.w3.org/2000/svg"><rect width="${viewSize}" height="${viewSize}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }

  global.createHomeKitSetupQrMatrix=createMatrix;
  global.renderHomeKitSetupQrSvg=renderSvg;
})(globalThis);
