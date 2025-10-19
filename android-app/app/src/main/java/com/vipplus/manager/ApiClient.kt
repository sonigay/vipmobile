package com.vipplus.manager

import android.util.Log
import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

object ApiClient {
    private const val TAG = "VipManager"
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    private val gson = Gson()
    
    /**
     * 데이터를 서버에 등록
     */
    fun registerSms(serverUrl: String, data: Map<String, String>): Boolean {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/register"
            val jsonBody = gson.toJson(data)
            
            Log.d(TAG, "데이터 등록 요청")
            
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "응답 코드: ${response.code}")
            
            return response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "등록 실패: ${e.message}", e)
            return false
        }
    }
    
    /**
     * 서버 연결 테스트
     */
    fun testConnection(serverUrl: String): Boolean {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/stats"
            
            Log.d(TAG, "연결 테스트")
            
            val request = Request.Builder()
                .url(url)
                .get()
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "테스트 응답: ${response.code}")
            
            return response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "연결 테스트 실패: ${e.message}", e)
            return false
        }
    }
    
    /**
     * 대기중인 전달 작업 조회
     */
    fun getPendingForwards(serverUrl: String): List<PendingForwardData> {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/received?status=대기중&limit=50"
            
            val request = Request.Builder()
                .url(url)
                .get()
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) {
                Log.e(TAG, "대기 작업 조회 실패: ${response.code}")
                return emptyList()
            }
            
            // JSON 파싱
            val jsonResponse = gson.fromJson(responseBody, Map::class.java)
            val dataList = jsonResponse["data"] as? List<*> ?: return emptyList()
            
            return dataList.mapNotNull { item ->
                val map = item as? Map<*, *> ?: return@mapNotNull null
                
                PendingForwardData(
                    id = map["id"]?.toString() ?: "",
                    message = map["message"]?.toString() ?: "",
                    targetNumbers = map["forwardTargets"]?.toString() ?: ""
                )
            }.filter { it.targetNumbers.isNotEmpty() }
            
        } catch (e: Exception) {
            Log.e(TAG, "대기 작업 조회 실패: ${e.message}", e)
            return emptyList()
        }
    }
    
    /**
     * 전달 상태 업데이트
     */
    fun updateForwardStatus(serverUrl: String, id: String, results: List<ForwardResult>): Boolean {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/update-forward-status"
            
            val data = mapOf(
                "smsId" to id,
                "results" to results.map { mapOf(
                    "targetNumber" to it.targetNumber,
                    "success" to it.success,
                    "errorMessage" to (it.errorMessage ?: "")
                )}
            )
            
            val jsonBody = gson.toJson(data)
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
            
            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "상태 업데이트 응답: ${response.code}")
            
            return response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "상태 업데이트 실패: ${e.message}", e)
            return false
        }
    }
    
    /**
     * 대기중인 자동응답 조회
     */
    fun getPendingAutoReplies(serverUrl: String, salesPhone: String): List<PendingAutoReplyData> {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/auto-reply/pending?salesPhone=$salesPhone"
            
            val request = Request.Builder()
                .url(url)
                .get()
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) {
                Log.e(TAG, "대기중인 자동응답 조회 실패: ${response.code}")
                return emptyList()
            }
            
            // JSON 파싱
            val jsonResponse = gson.fromJson(responseBody, Map::class.java)
            val dataList = jsonResponse["data"] as? List<*> ?: return emptyList()
            
            return dataList.mapNotNull { item ->
                val replyMap = item as? Map<*, *> ?: return@mapNotNull null
                
                PendingAutoReplyData(
                    id = replyMap["id"]?.toString() ?: "",
                    sender = replyMap["sender"]?.toString() ?: "",
                    reply = replyMap["reply"]?.toString() ?: ""
                )
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "대기중인 자동응답 조회 실패: ${e.message}", e)
            return emptyList()
        }
    }
    
    /**
     * 자동응답 발송 상태 업데이트
     */
    fun updateAutoReplyStatus(serverUrl: String, replyId: String, success: Boolean, errorMessage: String?): Boolean {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/auto-reply/update-status"
            
            val data = mapOf(
                "replyId" to replyId,
                "success" to success,
                "errorMessage" to (errorMessage ?: "")
            )
            
            val jsonBody = gson.toJson(data)
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
            
            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "자동응답 상태 업데이트 응답: ${response.code}")
            
            return response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "자동응답 상태 업데이트 실패: ${e.message}", e)
            return false
        }
    }
}


