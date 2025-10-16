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
}

