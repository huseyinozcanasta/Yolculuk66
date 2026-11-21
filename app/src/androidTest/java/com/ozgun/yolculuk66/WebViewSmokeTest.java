package com.ozgun.yolculuk66;

import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/** A real Android WebView smoke test, not a browser-only JS simulation. */
@RunWith(AndroidJUnit4.class)
public final class WebViewSmokeTest {
  @Rule public ActivityScenarioRule<MainActivity> scenario =
      new ActivityScenarioRule<>(MainActivity.class);

  private String javascript(String js) throws Exception {
    AtomicReference<String> result = new AtomicReference<>("");
    CountDownLatch completed = new CountDownLatch(1);
    scenario.getScenario().onActivity(activity -> {
      ViewGroup content = activity.findViewById(android.R.id.content);
      WebView view = (WebView) content.getChildAt(0);
      view.evaluateJavascript(js, value -> {
        result.set(value);
        completed.countDown();
      });
    });
    assertTrue("WebView evaluateJavascript timeout",completed.await(15, TimeUnit.SECONDS));
    return result.get();
  }

  private void awaitAppReady() throws Exception {
    for (int i=0; i<45; i++) {
      if ("true".equals(javascript("Boolean(window.HabitCore && window.YolculukBackup && window.YolculukCoach && document.querySelector('[data-tab=\"today\"]'))"))) return;
      Thread.sleep(450);
    }
    throw new AssertionError("App assets and JS modules did not initialize.");
  }

  @Test public void appLoadsOfflineAssetsAndSwitchesTabs() throws Exception {
    awaitAppReady();
    assertEquals("true", javascript("Boolean(document.querySelector('[data-tab=\"analysis\"]'))"));
    assertEquals("true", javascript(
      "document.querySelector('[data-tab=\"analysis\"]').click();" +
      "Boolean(document.querySelector('[data-action=\"checkUpdates\"]'))"
    ));
    assertEquals("true", javascript(
      "document.querySelector('[data-tab=\"coach\"]').click();" +
      "Boolean(document.querySelector('[data-question=\"Bu hafta nasıldım?\"]'))"
    ));
  }

  @Test public void officialGGUFDownloadButtonAndNativeHandoffArePresent() throws Exception {
    awaitAppReady();
    assertEquals("true",javascript(
      "document.querySelector('[data-tab=\"coach\"]').click();" +
      "Boolean(document.querySelector('[data-action=\"downloadLocalModel\"]'))"
    ));
    assertEquals("true",javascript("typeof window.AndroidAI.openModelDownload==='function'"));
  }

  @Test public void savedHabitSurvivesAndroidActivityRestart() throws Exception {
    awaitAppReady();
    String before=javascript(
      "localStorage.setItem('yolculuk66.offline.mvp.v1',JSON.stringify(" +
      "HabitCore.addTask(HabitCore.initialState()," +
      "{name:'Emülatör veri koruma testi',difficulty:'easy',core:true}," +
      "HabitCore.dayKey())));" +
      "JSON.parse(localStorage.getItem('yolculuk66.offline.mvp.v1')).tasks.length"
    );
    assertEquals("1",before);
    scenario.getScenario().recreate();
    awaitAppReady();
    assertEquals("true",javascript(
      "JSON.parse(localStorage.getItem('yolculuk66.offline.mvp.v1'))" +
      ".tasks.some(t=>t.name==='Emülatör veri koruma testi')"
    ));
  }
}
