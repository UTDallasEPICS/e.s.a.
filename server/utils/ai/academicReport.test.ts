/**
 * Purpose
 * Check the expected behavior of academic report.
 *
 * Inputs
 * - Test records, example requests, and the function being exercised.
 *
 * Outputs
 * - Passing assertions or a failure that identifies unexpected behavior.
 *
 * Pseudocode
 * Arrange the example → run the relevant function → compare its result with the expected behavior.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {executeAcademicPlan,resolveAcademicSemesters,validateAcademicPlan,runAcademicQuestion,requestedAcademicChart} from './academicReport'
import {normalizeV1Response} from '../../../app/components/database-redesign/aiResultPresentation'
// Define count for the steps below.
const count={source:'students',view:'count'}
// Call test to run this step.
test('real semester enrollment counts and explicit semester precedence',()=>{
  // Repeat the following steps for each item in [['fall 2026','SP26',159],['2026 fall year','SP26',159],['FA26','SP26',159],['fall 26','SP26',159],[.
  for(const [text,selected,expected] of [['fall 2026','SP26',159],['2026 fall year','SP26',159],['FA26','SP26',159],['fall 26','SP26',159],['how many students','SP26',150],['how many students','FA26',159]] as const){
    // Use executeAcademicPlan to initialize result.
    const result=executeAcademicPlan(count,resolveAcademicSemesters(text,selected));assert.equal(result.result.rows[0]?.values.students,expected)
  }
  // Call assert.equal to run this step.
  assert.equal(executeAcademicPlan(count,resolveAcademicSemesters('all semesters','FA26')).result.rows[0]?.values.students,286)
  // Call assert.equal to run this step.
  assert.equal(executeAcademicPlan(count,resolveAcademicSemesters('summer 2026','FA26')).status,'no_data')
  // Call assert.deepEqual to run this step.
  assert.deepEqual(new Set(resolveAcademicSemesters('compare Spring and Fall 2026','FA26')),new Set(['Spring 2026','Fall 2026']))
  // Call assert.deepEqual to run this step.
  assert.deepEqual(resolveAcademicSemesters('make it pie','FA26','students by major spring 2026'),['Spring 2026'])
  // Call assert.deepEqual to run this step.
  assert.deepEqual(resolveAcademicSemesters('Fall instead','SP26','students by major spring 2026'),['Fall 2026'])
})
// Call test to run this step.
test('course breakdowns match source totals and semester details',()=>{
  // Define plan for the steps below.
  const plan={source:'students',view:'chart',groupBy:['course'],chartType:'bar'}
  // Call assert.deepEqual to run this step.
  assert.deepEqual(Object.fromEntries(executeAcademicPlan(plan,['Spring 2026']).result.rows.map(r=>[r.values.course,r.values.students])),{'EPCS 2200':112,'EPCS 3200':38})
  // Call assert.deepEqual to run this step.
  assert.deepEqual(Object.fromEntries(executeAcademicPlan(plan,['Fall 2026']).result.rows.map(r=>[r.values.course,r.values.students])),{'EPCS 2200':108,'EPCS 3200':41,Unknown:10})
  // Call assert.equal to run this step.
  assert.equal(executeAcademicPlan({source:'projects',view:'count',filters:[{field:'projectStatus',operator:'eq',value:'New'}]},['Spring 2026']).result.rows[0]?.values.projects,10)
  // Call assert.equal to run this step.
  assert.equal(executeAcademicPlan({source:'projects',view:'count',filters:[{field:'projectStatus',operator:'eq',value:'New'}]},['Fall 2026']).result.rows[0]?.values.projects,18)
})
// Call test to run this step.
test('real project assignments can be listed and student flows use actual counts',()=>{
  // Use executeAcademicPlan to initialize list.
  const list=executeAcademicPlan({source:'assignments',view:'list',select:['studentName','project','semester'],filters:[{field:'project',operator:'contains',value:'Inventory Tracking'}]},['Fall 2026'])
  // Call assert.ok to run this step.
  assert.ok(list.result.rows.length>0);assert.ok(list.result.rows.every(r=>String(r.values.project).includes('Inventory Tracking')))
  // Use executeAcademicPlan to initialize flow.
  const flow=executeAcademicPlan({source:'assignments',view:'chart',groupBy:['classYear','project'],chartType:'sankey'},['Fall 2026'])
  // Call assert.equal to run this step.
  assert.equal(flow.result.rows.reduce((n,r)=>n+Number(r.values.students),0),158)
  // Call assert.ok to run this step.
  assert.ok(normalizeV1Response(flow)?.sankey)
})
// Call test to run this step.
test('all supported categorical styles render, including two-category series',()=>{
  // Repeat the following steps for each item in ['bar','horizontalBar','line','area','pie','doughnut','polarArea','radar','stackedBar'].
  for(const chartType of ['bar','horizontalBar','line','area','pie','doughnut','polarArea','radar','stackedBar']){
    // Use executeAcademicPlan to initialize result.
    const result=executeAcademicPlan({source:'students',view:'chart',groupBy:['course'],chartType},['Fall 2026'])
    // Call assert.equal to run this step.
    assert.equal(normalizeV1Response(result)?.chart?.type,chartType)
  }
  // Use executeAcademicPlan to initialize stacked.
  const stacked=executeAcademicPlan({source:'students',view:'chart',groupBy:['semester','course'],chartType:'stackedBar'},['Spring 2026','Fall 2026'])
  // Call assert.equal to run this step.
  assert.equal(normalizeV1Response(stacked)?.chart?.series.length,3)
})
// Call test to run this step.
test('numeric plots require actual measures and unsupported data is rejected',()=>{
  // Call assert.throws to run this step.
  assert.throws(()=>validateAcademicPlan({source:'students',view:'chart',chartType:'scatter',groupBy:['major']}))
  // Use executeAcademicPlan to initialize plot.
  const plot=executeAcademicPlan({source:'projects',view:'chart',chartType:'scatter',groupBy:['partner'],metrics:[{function:'sum',field:'teamSize',alias:'students'},{function:'countDistinct',field:'projectId',alias:'projects'}]},['Fall 2026'])
  // Call assert.ok to run this step.
  assert.ok(normalizeV1Response(plot)?.plot?.points.length)
  // Use executeAcademicPlan to initialize bubble.
  const bubble=executeAcademicPlan({source:'projects',view:'chart',chartType:'bubble',groupBy:['partner'],metrics:[{function:'sum',field:'teamSize',alias:'students'},{function:'countDistinct',field:'projectId',alias:'projects'},{function:'avg',field:'teamSize',alias:'averageTeam'}]},['Fall 2026'])
  // Call assert.ok to run this step.
  assert.ok(normalizeV1Response(bubble)?.plot?.points.every(p=>Number.isFinite(p.r)))
  // Repeat the following steps for each item in ['password','token','credential','startDate'].
  for(const field of ['password','token','credential','startDate'])assert.throws(()=>validateAcademicPlan({source:'students',view:'list',select:[field]}))
  // Call assert.throws to run this step.
  assert.throws(()=>validateAcademicPlan({source:'students',view:'list',select:['studentId']}))
  // Call assert.throws to run this step.
  assert.throws(()=>validateAcademicPlan({source:'students',view:'count',metrics:[{function:'sum',field:'major',alias:'total'}]}))
})
// Call test to run this step.
test('misspelled questions reach the model, wrong graphs are repaired, and followups remain available',async()=>{
  // Define calls for the steps below.
  let calls=0
  // Define result for the steps below.
  const result=await runAcademicQuestion('pie graoh students by course','FA26',{authorized:true,requestPlan:async messages=>{
    calls++;assert.match(JSON.stringify(messages),/pie graph students by course/)
    // Pass {source:'students',view:'chart',groupBy:['course'],chartType:calls===1?'bar':'pie'} back to the caller.
    return {source:'students',view:'chart',groupBy:['course'],chartType:calls===1?'bar':'pie'}
  }})
  // Call assert.equal to run this step.
  assert.equal(calls,2);assert.equal(result.status,'answer');assert.equal(requestedAcademicChart('sanky grpah'),'sankey')
  // Define queried for the steps below.
  let queried=false
  // Call assert.equal to run this step.
  assert.equal((await runAcademicQuestion('students','FA26',{authorized:false,requestPlan:async()=>{queried=true}})).status,'execution_error')
  // Call assert.equal to run this step.
  assert.equal(queried,false)
})

// Call test to run this step.
test('custom numeric axes preserve measure order and requested labels',()=>{
  // Use executeAcademicPlan to initialize result.
  const result=executeAcademicPlan({source:'projects',view:'chart',groupBy:['partner'],metrics:[{function:'countDistinct',field:'projectId',alias:'projects'},{function:'sum',field:'teamSize',alias:'students'}],chartType:'scatter',axes:{x:'students',y:'projects',xLabel:'People assigned',yLabel:'Project count'}},['Fall 2026'])
  // Define presentation for the steps below.
  const presentation=normalizeV1Response(result)!
  // Call assert.equal to run this step.
  assert.equal(presentation.plot?.xLabel,'Students')
  // Call assert.equal to run this step.
  assert.equal(presentation.plot?.yLabel,'Projects')
  // Call assert.equal to run this step.
  assert.equal(presentation.axisLabels?.x,'People assigned')
  // Call assert.equal to run this step.
  assert.equal(presentation.axisLabels?.y,'Project count')
  // Call assert.throws to run this step.
  assert.throws(()=>validateAcademicPlan({source:'projects',view:'chart',groupBy:['partner'],chartType:'bar',axes:{x:'salary',y:'students'}}))
})
// Call test to run this step.
test('roster results carry real profile links and disambiguate same-named projects',()=>{
  // Use executeAcademicPlan to initialize response.
  const response=executeAcademicPlan({source:'assignments',view:'list',select:['studentName','project','partner','semester'],filters:[{field:'project',operator:'contains',value:'Inventory Tracking'}]},['Fall 2026'])
  // Define result for the steps below.
  const result=normalizeV1Response(response)!.result!
  // Call assert.ok to run this step.
  assert.ok(result.rows.length)
  // Repeat the following steps for each item in result.rows.
  for(const row of result.rows){
    // Call assert.ok to run this step.
    assert.ok(row.references?.some(ref=>ref.type==='student'&&ref.field==='studentName'&&ref.semesterId==='FA26'))
    // Call assert.ok to run this step.
    assert.ok(row.references?.some(ref=>ref.type==='project'&&ref.field==='project'&&ref.semesterId==='FA26'))
    // Call assert.ok to run this step.
    assert.ok(row.references?.some(ref=>ref.type==='partner'&&ref.field==='partner'))
  }
})
