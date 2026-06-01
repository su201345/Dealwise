import SwiftUI
import WebKit
import UIKit

struct DealwiseWebView: UIViewRepresentable {
    let fileName: String
    let fileExtension: String

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .clear

        loadLocalHTML(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) { }

    private func loadLocalHTML(in webView: WKWebView) {
        guard let url = Bundle.main.url(forResource: fileName, withExtension: fileExtension) else {
            webView.loadHTMLString("<h1>Dealwise file not found</h1><p>Make sure dealwise.html is included in Copy Bundle Resources.</p>", baseURL: nil)
            return
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if url.scheme == "http" || url.scheme == "https" {
                if navigationAction.navigationType == .linkActivated || navigationAction.targetFrame == nil {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }

            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url, url.scheme == "http" || url.scheme == "https" {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}
