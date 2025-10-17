package com.smsforwarder

import android.util.Log
import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

object ApiClient {
    private const val TAG = "ApiClient"
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    private val gson = Gson()
    
    /**
     * SMS를 서버에 등록
     */
    fun registerSms(serverUrl: String, smsData: Map<String, String>): Boolean {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/register"
            val jsonBody = gson.toJson(smsData)
            
            Log.d(TAG, "SMS 등록 요청: $url")
            Log.d(TAG, "데이터: $jsonBody")
            
            val requestBody = jsonBody.toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "응답 코드: ${response.code}")
            Log.d(TAG, "응답 본문: $responseBody")
            
            return response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "SMS 등록 실패: ${e.message}", e)
            return false
        }
    }
    
    /**
     * 서버 연결 테스트
     */
    fun testConnection(serverUrl: String): Boolean {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/stats"
            
            Log.d(TAG, "연결 테스트: $url")
            
            val request = Request.Builder()
                .url(url)
                .get()
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            Log.d(TAG, "테스트 응답: ${response.code}, $responseBody")
            
            return response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "연결 테스트 실패: ${e.message}", e)
            return false
        }
    }
    
    /**
     * 대기중인 SMS 조회
     */
    fun getPendingSms(serverUrl: String): List<PendingSmsData> {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/received?status=대기중&limit=50"
            
            val request = Request.Builder()
                .url(url)
                .get()
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (!response.isSuccessful) {
                Log.e(TAG, "대기중인 SMS 조회 실패: ${response.code}")
                return emptyList()
            }
            
            // JSON 파싱
            val jsonResponse = gson.fromJson(responseBody, Map::class.java)
            val dataList = jsonResponse["data"] as? List<*> ?: return emptyList()
            
            return dataList.mapNotNull { item ->
                val smsMap = item as? Map<*, *> ?: return@mapNotNull null
                
                PendingSmsData(
                    id = smsMap["id"]?.toString() ?: "",
                    message = smsMap["message"]?.toString() ?: "",
                    targetNumbers = smsMap["forwardTargets"]?.toString() ?: ""
                )
            }.filter { it.targetNumbers.isNotEmpty() }
            
        } catch (e: Exception) {
            Log.e(TAG, "대기중인 SMS 조회 실패: ${e.message}", e)
            return emptyList()
        }
    }
    
    /**
     * SMS 전달 상태 업데이트
     */
    fun updateForwardStatus(serverUrl: String, smsId: String, results: List<ForwardResult>): Boolean {
        try {
            val url = "${serverUrl.trimEnd('/')}/api/sms/update-forward-status"
            
            val data = mapOf(
                "smsId" to smsId,
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
            
            Log.d(TAG, "상태 업데이트 응답: ${response.code}, $responseBody")
            
            return response.isSuccessful
        } catch (e: Exception) {
            Log.e(TAG, "상태 업데이트 실패: ${e.message}", e)
            return false
        }
    }
}

