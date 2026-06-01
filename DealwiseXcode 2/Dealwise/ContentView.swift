import SwiftUI

struct ContentView: View {
    var body: some View {
        DealwiseWebView(fileName: "dealwise", fileExtension: "html")
            .ignoresSafeArea(.container, edges: .bottom)
    }
}

#Preview {
    ContentView()
}
