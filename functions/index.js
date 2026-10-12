const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const admin=require('firebase-admin');const crypto=require('node:crypto');const cloudinary=require('cloudinary').v2;
admin.initializeApp();const db=admin.firestore();
const CLOUD_NAME=defineSecret('CLOUDINARY_CLOUD_NAME'),API_KEY=defineSecret('CLOUDINARY_API_KEY'),API_SECRET=defineSecret('CLOUDINARY_API_SECRET');
async function isAdmin(uid){if(!uid)return false;const doc=await db.doc('admins/'+uid).get();return doc.exists && doc.data().active===true;}
const region='us-central1';
exports.signImageUpload=onCall({region,secrets:[CLOUD_NAME,API_KEY,API_SECRET],maxInstances:10},async request=>{
 if(!(await isAdmin(request.auth?.uid)))throw new HttpsError('permission-denied','Admin access required');
 const timestamp=Math.floor(Date.now()/1000),folder='frank-news',public_id=crypto.randomUUID();
 const signature=cloudinary.utils.api_sign_request({folder,public_id,timestamp},API_SECRET.value());
 return {cloudName:CLOUD_NAME.value(),api_key:API_KEY.value(),timestamp,folder,public_id,signature};
});
const rateKey=(req,purpose)=>{const ip=req.rawRequest?.ip||'unknown';return crypto.createHash('sha256').update(purpose+'|'+ip).digest('hex');};
exports.submitComment=onCall({region,maxInstances:20},async req=>{
 const {postId,name,text,website}=req.data||{};if(website)return {queued:true};
 if(typeof postId!=='string'||!/^[-a-z0-9]{1,110}$/.test(postId)||typeof name!=='string'||name.trim().length<2||name.length>60||typeof text!=='string'||text.trim().length<3||text.length>1500)throw new HttpsError('invalid-argument','Invalid comment');
 const post=await db.doc('posts/'+postId).get();if(!post.exists||post.data().status!=='published')throw new HttpsError('not-found','Post unavailable');
 const bucket=Math.floor(Date.now()/3600000),key=rateKey(req,'comments'+bucket),ref=db.doc('rateLimits/'+key);
 await db.runTransaction(async tx=>{const snap=await tx.get(ref);const n=snap.data()?.count||0;if(n>=3)throw new HttpsError('resource-exhausted','Try again later.');tx.set(ref,{count:n+1,expiresAt:admin.firestore.Timestamp.fromMillis(Date.now()+86400000)});});
 await db.collection('comments').add({postId,name:name.trim(),text:text.trim(),status:'pending',createdAt:admin.firestore.FieldValue.serverTimestamp()});return {queued:true};
});
exports.moderateComment=onCall({region},async req=>{
 if(!(await isAdmin(req.auth?.uid)))throw new HttpsError('permission-denied','Admin only');
 const {commentId,status}=req.data||{};if(!/^[A-Za-z0-9]{15,30}$/.test(commentId||'')||!['approved','rejected'].includes(status))throw new HttpsError('invalid-argument','Invalid request');
 const ref=db.doc('comments/'+commentId);await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError('not-found','Comment unavailable');const prev=snap.data().status;tx.update(ref,{status,moderatedAt:admin.firestore.FieldValue.serverTimestamp(),moderatedBy:req.auth.uid});const diff=(status==='approved'?1:0)-(prev==='approved'?1:0);if(diff)tx.set(db.doc('publicStats/global'),{approvedComments:admin.firestore.FieldValue.increment(diff)},{merge:true});});return {ok:true};
});
exports.recordVisit=onCall({region,maxInstances:50},async req=>{
 const {kind,postId}=req.data||{};if(kind!=='site'&&kind!=='post')throw new HttpsError('invalid-argument','Invalid visit kind');
 if(kind==='post'){if(typeof postId!=='string'||!/^[-a-z0-9]{1,110}$/.test(postId))throw new HttpsError('invalid-argument','Bad article');const p=await db.doc('posts/'+postId).get();if(!p.exists||p.data().status!=='published')return {recorded:false};}
 const today=new Date().toISOString().slice(0,10),key=rateKey(req,kind+(postId||'')+today),ref=db.doc('rateLimits/'+key);
 const recorded=await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists)return false;tx.set(ref,{count:1,expiresAt:admin.firestore.Timestamp.fromMillis(Date.now()+3*86400000)});if(kind==='site'){tx.set(db.doc('publicStats/global'),{visits:admin.firestore.FieldValue.increment(1)},{merge:true});tx.set(db.doc('dailyStats/'+today),{visits:admin.firestore.FieldValue.increment(1)},{merge:true});}else tx.update(db.doc('posts/'+postId),{views:admin.firestore.FieldValue.increment(1)});return true;});return {recorded};
});
