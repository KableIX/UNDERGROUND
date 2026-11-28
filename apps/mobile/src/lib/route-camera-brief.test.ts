import {describe,expect,it} from 'vitest';
import {routeCameraBrief} from './route-camera-brief';
import type {Snapshot} from '../map-layers/cameras';

const db:Snapshot={retrieved:'2026-11-27',counts:{reader:1,osm:1,sf:0,sj:1,oak:0,la:0},cells:{
 '-1220,373':[
 [-121.99,37.35,'speed','sj','a','Main Street',''],
 [-121.99,37.35,'speed','sj','a','Main Street',''],
 [-121.98,37.35,'speed','osm','b','Red Light Camera',''],
 [-121.97,37.35,'plate','reader','c','Flock Safety',''],
 [-121.97,37.36,'plate','reader','d','Flock Safety',''],
 ]}};
const route=[[-121.995,37.35],[-121.98,37.35],[-121.965,37.35]];
describe('offline fixed infrastructure context',()=>{
 it('counts unique source records near saved route segments, not live enforcement',()=>{
  const a=routeCameraBrief(db,route,'CA');
  expect(a).toEqual({state:'partial',snapshot:'2026-11-27',speed:1,redlight:1,plate:1});
  expect(routeCameraBrief(db,[...route].reverse(),'CA')).toEqual(a);
 });
 it('returns unknown outside existing coverage or without geometry',()=>{
  expect(routeCameraBrief(db,route,'FL').state).toBe('unknown');
  expect(routeCameraBrief(db,route,undefined).state).toBe('unknown');
  expect(routeCameraBrief(null,route,'CA').state).toBe('unknown');
  expect(routeCameraBrief(db,[],'CA').state).toBe('unknown');
 });
 it('does not infer coverage from zero matches or jump across route gaps',()=>{
  expect(routeCameraBrief(db,[[-121.99,37.37],[-121.98,37.37]],'CA').state).toBe('partial');
  expect(routeCameraBrief(db,[[-122.2,37.35],[-121.9,37.35]],'CA').speed).toBe(0);
 });
});
