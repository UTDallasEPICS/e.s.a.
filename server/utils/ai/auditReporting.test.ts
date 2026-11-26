/**
 * Purpose
 * Check the expected behavior of audit reporting.
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
import test,{after} from 'node:test'
import baseline from '../../../app/components/verified-data.json'
import {academicRows,executeAcademicPlan,validateAcademicPlan,fields,academicSuggestions,runAcademicQuestion,resolveAcademicSemesters} from './academicReport'
import {withReportData,validateWorkspace,loadReportData} from './academicReportData'
import {reportConversation,rememberReport,safeResultContext} from './academicReportConversation'
import {localRefinement,localLookup,cachedReportPlan} from './reportPlanCacheAndShortcuts'
import {normalizeV1Response,formatV1Value} from '../../../app/components/database-redesign/aiResultPresentation'
import {prisma} from '../prisma'
// Call after to run this step.
after(()=>prisma.$disconnect())
// Call test to run this step.
test('every declared academic field is selectable or usable as a recorded identifier',()=>{
 // Repeat the following steps for each item in Object.entries(fields).
 for(const [source,names] of Object.entries(fields))for(const field of names){
  // Check whether field.endsWith('Id') before running this branch.
  if(field.endsWith('Id')){assert.doesNotThrow(()=>validateAcademicPlan({source,view:'count',metrics:[{function:'countDistinct',field,alias:'records'}]}));continue}
  // Call assert.doesNotThrow to run this step.
  assert.doesNotThrow(()=>executeAcademicPlan({source,view:'list',select:[field]},['Spring 2026','Fall 2026']),`${source}.${field}`)
 }
 // Repeat the following steps for each item in ['password','token','apiKey','session','credential'].
 for(const field of ['password','token','apiKey','session','credential'])assert.throws(()=>validateAcademicPlan({source:'students',view:'list',select:[field]}))
})
// Call test to run this step.
test('all preference rows remain accessible and missing contact/mentor values are not invented',()=>{
 // Call assert.equal to run this step.
 assert.equal(executeAcademicPlan({source:'preferences',view:'count'},['Spring 2026','Fall 2026']).result.rows[0]?.values.preferences,baseline.choices.length)
 // Call assert.ok to run this step.
 assert.ok(academicRows('contacts').every(r=>String(r.effectivePeriod).includes('Not supplied')))
 // Call assert.ok to run this step.
 assert.ok(academicRows('mentors').every(r=>r.mentorName))
 // Call assert.equal to run this step.
 assert.equal(executeAcademicPlan({source:'students',view:'count',filters:[{field:'email',operator:'isEmpty'}]},['Fall 2026']).status,'answer')
})
// Call test to run this step.
test('current workspace snapshots are validated and queries reflect isolated edits',async()=>{
 // Use validateWorkspace to initialize current.
 const current=validateWorkspace(baseline)
 // Define id for the steps below.
 const id=current.students.find(s=>s.semesters.includes('FA26'))!.id
 // Define student for the steps below.
 const student=current.students.find(s=>s.id===id)!
 // Update student.enrollmentDetails!['FA26']!.major with the value on the right.
 student.enrollmentDetails!['FA26']!.major='Audit-only changed major'
 // Define modified for the steps below.
 const modified={...baseline,...current}
 await Promise.all([
  withReportData(modified,async()=>{await new Promise(r=>setTimeout(r,5));assert.equal(academicRows('students').find(r=>r.studentId===id&&r.semester==='Fall 2026')?.major,'Audit-only changed major')}),
  withReportData({...baseline},async()=>{await new Promise(r=>setTimeout(r,1));assert.notEqual(academicRows('students').find(r=>r.studentId===id&&r.semester==='Fall 2026')?.major,'Audit-only changed major')})
 ])
 // Call assert.notEqual to run this step.
 assert.notEqual(academicRows('students').find(r=>r.studentId===id&&r.semester==='Fall 2026')?.major,'Audit-only changed major')
})
// Call test to run this step.
test('database metadata and source notes are available without querying auth records',async()=>{
 // Define data for the steps below.
 const data=await loadReportData()
 // Call withReportData to run this step.
 withReportData(data,()=>{
  // Call assert.ok to run this step.
  assert.ok(academicRows('students').some(r=>r.recordCreatedAt))
  // Call assert.ok to run this step.
  assert.ok(academicRows('students').some(r=>r.comments))
  // Call assert.ok to run this step.
  assert.ok(academicRows('contacts').some(r=>r.contactEmail))
 })
 // Call assert.equal to run this step.
 assert.equal(data._database.users,undefined)
})
// Call test to run this step.
test('percentage shares use all matched groups before pagination and never become chart series',()=>{
 // Use executeAcademicPlan to initialize response.
 const response=executeAcademicPlan({source:'students',view:'chart',groupBy:['course'],chartType:'pie',limit:1},['Fall 2026'])
 // Define share for the steps below.
 const share=response.result.columns.find(c=>c.tableOnly)!
 // Define row for the steps below.
 const row=response.result.rows[0]!
 // Call assert.equal to run this step.
 assert.equal(row.values[share.key],Number(row.values.students)/159*100)
 // Define v for the steps below.
 const v=normalizeV1Response(response)!
 // Call assert.equal to run this step.
 assert.equal(v.chart?.series.length,1)
 // Call assert.match to run this step.
 assert.match(formatV1Value(share as any,row.values[share.key]),/%$/)
 // Use executeAcademicPlan to initialize all.
 const all=executeAcademicPlan({source:'students',view:'chart',groupBy:['course'],chartType:'pie'},['Fall 2026'])
 // Call assert.ok to run this step.
 assert.ok(Math.abs(all.result.rows.reduce((n,r)=>n+Number(r.values[share.key]),0)-100)<1e-8)
 // Use executeAcademicPlan to initialize average.
 const average=executeAcademicPlan({source:'projects',view:'chart',groupBy:['partner'],metrics:[{function:'avg',field:'teamSize',alias:'average'}],chartType:'bar'},['Fall 2026'])
 // Call assert.equal to run this step.
 assert.equal(average.result.columns.some(c=>c.tableOnly),false)
})
// Call test to run this step.
test('differences, percentages, zero denominators and percent growth use explicit populations',()=>{
 // Define metrics for the steps below.
 const metrics=[{function:'countDistinct',field:'studentId',alias:'fall',hidden:true,filters:[{field:'semester',operator:'eq',value:'Fall 2026'}]},{function:'countDistinct',field:'studentId',alias:'spring',hidden:true,filters:[{field:'semester',operator:'eq',value:'Spring 2026'}]}]
 // Use executeAcademicPlan to initialize diff.
 const diff=executeAcademicPlan({source:'students',view:'count',metrics,calculations:[{function:'difference',numerator:'fall',denominator:'spring',alias:'difference'}]},['Spring 2026','Fall 2026'])
 // Call assert.equal to run this step.
 assert.equal(diff.result.rows[0]?.values.difference,9)
 // Use executeAcademicPlan to initialize growth.
 const growth=executeAcademicPlan({source:'students',view:'count',metrics,calculations:[{function:'percentChange',numerator:'fall',denominator:'spring',alias:'growth'}]},['Spring 2026','Fall 2026'])
 // Call assert.equal to run this step.
 assert.equal(growth.result.rows[0]?.values.growth,6)
 // Use executeAcademicPlan to initialize zero.
 const zero=executeAcademicPlan({source:'students',view:'count',metrics:[{function:'count',alias:'all',hidden:true},{function:'count',alias:'none',hidden:true,filters:[{field:'studentName',operator:'eq',value:'no such recorded student'}]}],calculations:[{function:'percentage',numerator:'all',denominator:'none',alias:'percent'}]},['Fall 2026'])
 // Call assert.equal to run this step.
 assert.equal(zero.result.rows[0]?.values.percent,'Not available')
})
// Call test to run this step.
test('two-project, demographic and OR comparisons stay within requested populations',()=>{
 // Use executeAcademicPlan to initialize projects.
 const projects=executeAcademicPlan({source:'projects',view:'list',select:['projectNumber','partner','semester','teamSize'],filters:[{field:'projectNumber',operator:'in',value:[72,75]}]},['Fall 2026'])
 // Call assert.equal to run this step.
 assert.equal(projects.result.rows.length,2)
 // Use executeAcademicPlan to initialize genders.
 const genders=executeAcademicPlan({source:'students',view:'chart',groupBy:['semester','gender'],chartType:'stackedBar'},['Spring 2026','Fall 2026'])
 // Call assert.equal to run this step.
 assert.equal(normalizeV1Response(genders)?.chart?.series.reduce((n,s)=>n+s.values.reduce((a,b)=>a+b,0),0),309)
 // Use executeAcademicPlan to initialize or.
 const or=executeAcademicPlan({source:'students',view:'count',orFilters:[[{field:'classYear',operator:'eq',value:'Freshman'}],[{field:'classYear',operator:'eq',value:'Senior'}]]},['Fall 2026'])
 // Call assert.ok to run this step.
 assert.ok(Number(or.result.rows[0]?.values.students)>0)
 // Call assert.doesNotThrow to run this step.
 assert.doesNotThrow(()=>executeAcademicPlan({source:'assignments',view:'list',select:['studentName','preferenceRank'],filters:[{field:'preferenceRank',operator:'gte',value:2}]},['Fall 2026']))
})
// Call test to run this step.
test('result pages expose every matching row without silent truncation',()=>{
 // Define plan for the steps below.
 const plan={source:'students',view:'list',select:['studentName','semester'],limit:100}
 // Use executeAcademicPlan to initialize a.
 const a=executeAcademicPlan(plan,['Fall 2026']),b=executeAcademicPlan({...plan,offset:100},['Fall 2026'])
 // Call assert.equal to run this step.
 assert.equal(a.result.totalRows,159);assert.equal(a.result.rows.length,100);assert.equal(b.result.rows.length,59);assert.equal(b.result.hasMore,false)
 // Call assert.equal to run this step.
 assert.equal(new Set([...a.result.rows,...b.result.rows].map(r=>r.key)).size,159)
 // Call assert.equal to run this step.
 assert.equal(executeAcademicPlan({...plan,limit:1000},['Spring 2026','Fall 2026']).result.rows.length,309)
})
// Call test to run this step.
test('conversations are owner-isolated and retain safe actual result context',()=>{
 // Use reportConversation to initialize first.
 const first=reportConversation('audit-user-a',undefined)
 // Use executeAcademicPlan to initialize result.
 const result=executeAcademicPlan({source:'projects',view:'list',select:['project','partner','semester']},['Fall 2026'])
 // Call rememberReport to run this step.
 rememberReport(first.session,'show projects',{...result,semesterScope:['Fall 2026']},'SP26')
 // Use reportConversation to initialize again.
 const again=reportConversation('audit-user-a',first.id)
 // Call assert.equal to run this step.
 assert.equal(again.session.turns.length,1)
 // Call assert.deepEqual to run this step.
 assert.deepEqual(safeResultContext(again.session.turns[0])?.semesterScope,['Fall 2026'])
 // Use reportConversation to initialize other.
 const other=reportConversation('audit-user-b',first.id)
 // Call assert.notEqual to run this step.
 assert.notEqual(other.id,first.id);assert.equal(other.session.turns.length,0)
})
// Call test to run this step.
test('multi-turn followups use actual prior scope and fast refinements preserve filters',async()=>{
 // Use validateAcademicPlan to initialize previous.
 const previous=validateAcademicPlan({source:'students',view:'chart',groupBy:['course'],chartType:'bar',filters:[{field:'classYear',operator:'eq',value:'4th Year'}]})
 // Define pie for the steps below.
 const pie=localRefinement(previous,'make it pie')!
 // Call assert.equal to run this step.
 assert.equal(pie.chartType,'pie');assert.deepEqual(pie.filters,previous.filters)
 // Define called for the steps below.
 let called=false
 // Define response for the steps below.
 const response=await runAcademicQuestion('only first-years','SP26',{authorized:true,previousQuestion:'make it pie',previousPlan:previous,previousScope:['Fall 2026'],requestPlan:async()=>{called=true;return {source:'students',view:'count',filters:[{field:'classYear',operator:'eq',value:'1st Year'}]}}})
 // Call assert.equal to run this step.
 assert.equal(response.status,'answer');assert.deepEqual(response.semesterScope,['Fall 2026'])
 // Call assert.ok to run this step.
 assert.ok(localLookup('Who was the partner for Inventory Tracking in Fall 2026?'))
})
// Call test to run this step.
test('typo suggestions use actual entity names and never silently alter the requested identity',()=>{
 // Use validateAcademicPlan to initialize plan.
 const plan=validateAcademicPlan({source:'projects',view:'list',select:['project','partner'],filters:[{field:'project',operator:'contains',value:'Inventroy Trakcing'}]})
 // Use academicSuggestions to initialize suggestions.
 const suggestions=academicSuggestions(plan,'Who was the partner for Inventroy Trakcing?',['Fall 2026'])
 // Call assert.ok to run this step.
 assert.ok(suggestions.some(q=>q.includes('Inventory Tracking')))
 // Call assert.deepEqual to run this step.
 assert.deepEqual(resolveAcademicSemesters('bar studnets flal2026','SP26'),['Fall 2026'])
})
// Call test to run this step.
test('plan cache reuses interpretation while execution remains fresh',async()=>{
 // Define calls for the steps below.
 let calls=0
 // Define request for the steps below.
 const request=async()=>{calls++;return {source:'students',view:'count'}}
 // Define a for the steps below.
 const a=await cachedReportPlan('audit-cache-user','model',[{content:'same'}],request)
 // Define b for the steps below.
 const b=await cachedReportPlan('audit-cache-user','model',[{content:'same'}],request)
 // Call assert.equal to run this step.
 assert.equal(calls,1);assert.deepEqual(a,b)
 await cachedReportPlan('another-audit-user','model',[{content:'same'}],request)
 // Call assert.equal to run this step.
 assert.equal(calls,2)
})

// Call test to run this step.
test('limited composition charts retain the full population denominator',()=>{
 // Use executeAcademicPlan to initialize result.
 const result=executeAcademicPlan({source:'students',view:'chart',groupBy:['course'],metrics:[{function:'countDistinct',field:'studentId',alias:'students'}],chartType:'pie',orderBy:{field:'students',direction:'desc'},limit:1},['Fall 2026'])
 // Define view for the steps below.
 const view=normalizeV1Response(result)!
 // Call assert.equal to run this step.
 assert.equal(result.result.rows.length,1)
 // Call assert.deepEqual to run this step.
 assert.deepEqual(view.chart?.labels,['EPCS 2200','Other matching groups'])
 // Call assert.equal to run this step.
 assert.equal(view.chart?.series[0]?.values.reduce((a,b)=>a+b,0),159)
 // Call assert.equal to run this step.
 assert.equal(result.result.rows[0]?.values.__share_students,108/159*100)
})
// Call test to run this step.
test('summary calculations expose the requested percentage and supporting counts',()=>{
 // Use executeAcademicPlan to initialize result.
 const result=executeAcademicPlan({source:'students',view:'summary',metrics:[{function:'countDistinct',field:'studentId',alias:'newCount',filters:[{field:'semester',operator:'eq',value:'Fall 2026'}]},{function:'countDistinct',field:'studentId',alias:'oldCount',filters:[{field:'semester',operator:'eq',value:'Spring 2026'}]}],calculations:[{function:'percentChange',numerator:'newCount',denominator:'oldCount',alias:'growth'}]},['Spring 2026','Fall 2026'])
 // Call assert.equal to run this step.
 assert.equal(result.result.kind,'aggregate')
 // Call assert.deepEqual to run this step.
 assert.deepEqual(normalizeV1Response(result)?.summary,{label:'Growth',value:6,unit:'percent'})
})
