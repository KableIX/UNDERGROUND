import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, PixelRatio, Platform, StyleSheet, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { homeCamera, limit, type Camera } from './camera';

import {cars,defaultBuilds,type Car,type Spec} from './builds';
const poster = require('../../assets/garage/r8-showroom.jpg');
type Size = { width: number; height: number };
type Drag = { x: number; y: number; span: number; camera: Camera; fingers: number };
type Props = { warm: boolean; resetKey: number; car?:Car; spec?:Spec };
function touch(event: GestureResponderEvent) {
  const touches = event.nativeEvent.touches;
  const a = touches[0] ?? event.nativeEvent, b = touches[1];
  return {
    x: b ? (a.pageX+b.pageX)/2 : a.pageX,
    y: b ? (a.pageY+b.pageY)/2 : a.pageY,
    span: b ? Math.hypot(a.pageX-b.pageX, a.pageY-b.pageY) : 0,
    fingers: touches.length,
  };
}

export function GarageStage({ warm, resetKey, car = 'r8', spec = defaultBuilds.builds[car] }: Props) {
  const size = useRef<Size>({width: 0, height: 0});
  const camera = useRef({ ...homeCamera });
  const drag = useRef<Drag | null>(null);
  const build = useRef({car,spec});
  const lighting = useRef(warm);
  const raf = useRef<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [frames, setFrames] = useState<[string | null, string | null]>([null,null]);
  const [visible, setVisible] = useState<0 | 1>(0);
  const front = useRef<0 | 1>(0);
  const loaded = useRef<[string | null,string | null]>([null,null]);
  const decoding = useRef<string | null>(null);
  const pending = useRef<'moving' | 'settled' | null>(null);
  const [failed,setFailed] = useState(false);
  const alive=useRef(true);

  const paint = useCallback(function schedule(quality: 'moving' | 'settled') {
    pending.current = quality;
    if (raf.current !== null || decoding.current || !alive.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const {width,height}=size.current;
      if (!width || !height || !alive.current) return;
      const mode=pending.current;
      pending.current=null;
      const longest = mode === 'moving' ? 435 : 1030;
      const scale = Math.min(PixelRatio.get(),longest / Math.max(width,height));
      // Load the material maps only after a showroom surface has actually mounted.
      const { renderGarage } = require('./render') as typeof import('./render');
      const uri=renderGarage(Math.max(2,Math.round(width*scale)),Math.max(2,Math.round(height*scale)),camera.current,lighting.current,build.current.car,build.current.spec);
      const back=front.current===0 ? 1 : 0;
      if(loaded.current[front.current]===uri) return;
      if(loaded.current[back]===uri) {front.current=back;setVisible(back);return;}
      loaded.current[back]=null;
      decoding.current=uri;
      setFrames(previous => back===0 ? [uri,previous[1]] : [previous[0],uri]);
    });
  },[]);

  function displayed(slot: 0 | 1, uri: string) {
    if (decoding.current!==uri || !alive.current) return;
    decoding.current=null;
    loaded.current[slot]=uri;
    front.current=slot;
    setVisible(slot);setFailed(false);
    if (pending.current) paint(pending.current);
  }
  function finish() {
    drag.current=null;
    if (settle.current) clearTimeout(settle.current);
    settle.current=setTimeout(()=>paint('settled'),70);
  }
  function begin(e: GestureResponderEvent) {
    if(settle.current) clearTimeout(settle.current);
    drag.current={ ...touch(e), camera:{...camera.current} };
  }
  function move(e: GestureResponderEvent) {
    const point=touch(e);
    const start=drag.current;
    if (!start || start.fingers!==point.fingers) { begin(e);return; }
    const {width,height}=size.current;
    camera.current={
      yaw:start.camera.yaw-(point.x-start.x)*Math.PI*2/Math.max(1,width),
      pitch:limit(start.camera.pitch+(point.y-start.y)*1.15/Math.max(1,height),.065,.59),
      zoom:point.span && start.span ? limit(start.camera.zoom*point.span/start.span,.78,1.28) : start.camera.zoom,
    };
    paint('moving');
  }
  useEffect(()=>{
    alive.current=true;
    return ()=>{alive.current=false;if(raf.current!==null)cancelAnimationFrame(raf.current);if(settle.current)clearTimeout(settle.current);};
  },[]);
  useEffect(()=>{ lighting.current=warm;build.current={car,spec};paint('settled'); },[car,spec,warm,paint]);
  useEffect(()=>{ camera.current={...homeCamera};paint('settled'); },[resetKey,paint]);
  return <View style={styles.stage} onLayout={({nativeEvent:{layout}})=>{
      if(size.current.width===layout.width && size.current.height===layout.height)return;
      size.current={width:layout.width,height:layout.height};paint('settled');
    }}
    accessible accessibilityRole="adjustable" accessibilityLabel={cars[car]+' in the 3D showroom'}
    accessibilityHint={failed ? 'Activate to retry the 3D view.' : 'Swipe up or down with VoiceOver to rotate the car.'}
    accessibilityActions={[{name:'increment',label:'Rotate right'},{name:'decrement',label:'Rotate left'},{name:'activate',label:'Reset camera'}]}
    onAccessibilityAction={({nativeEvent:{actionName}})=>{
      if(actionName==='activate')camera.current={...homeCamera};
      else camera.current.yaw+=actionName==='increment' ? Math.PI/8 : -Math.PI/8;
      paint('settled');
    }}
    onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true}
    onTouchStart={e=>{
      if(drag.current && drag.current.fingers!==e.nativeEvent.touches.length) begin(e);
    }}
    onResponderGrant={begin} onResponderMove={move} onResponderRelease={finish}
    onResponderTerminate={finish} onResponderTerminationRequest={()=>false}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {car==='r8' && spec===defaultBuilds.builds.r8 && <Image source={poster} style={styles.surface} resizeMode="contain" accessible={false}/>}
      {([0,1] as const).map(slot=>{
        const uri=frames[slot];
        return uri ? <Image key={slot} source={{uri}} accessible={false} fadeDuration={0}
          style={[styles.surface,{opacity:visible===slot && front.current===slot ? 1 : 0}]}
          resizeMode="stretch" onLoad={()=>displayed(slot,uri)} onError={()=>{
            if(decoding.current===uri){decoding.current=null;setFailed(true);if(pending.current)paint(pending.current);}
          }}/> : null;
      })}
    </View>
  </View>;
}
const styles=StyleSheet.create({
  stage:{flex:1,minHeight:0,minWidth:0,overflow:'hidden',backgroundColor:'#161a1d',...Platform.select({web:{touchAction:'none'} as ViewStyle})},
  surface:{position:'absolute',left:0,top:0,width:'100%',height:'100%'},
});
