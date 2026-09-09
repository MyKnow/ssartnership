import Foundation
import Security

// Default macOS login keychain / per-application ACL. No synchronizable
// attribute, access-group sharing, ACL broadening, or keychain unlocking.
func fail(_ status: OSStatus = errSecParam) -> Never {
    FileHandle.standardError.write(Data("KEYCHAIN_OPERATION_FAILED:\(status)\n".utf8))
    exit(1)
}
let args = CommandLine.arguments
guard args.count == 4, ["put", "get", "delete-test"].contains(args[1]),
      ["recovery", "test"].contains(args[2]), UUID(uuidString: args[3]) != nil else { fail() }
let service = "dev.myknow.ssartnership.\(args[2])-key"
var query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service, kSecAttrAccount as String: args[3]]
switch args[1] {
case "put":
    var input = Data()
    while true {
        do {
            guard let chunk = try FileHandle.standardInput.read(upToCount: 4096), !chunk.isEmpty else { break }
            input.append(chunk)
            guard input.count <= 16384 else { fail() }
        } catch { fail() }
    }
    guard !input.isEmpty else { fail() }
    query[kSecValueData as String] = input
    query[kSecAttrLabel as String] = "SSARTNERSHIP recovery recipient"
    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess else { fail(status) }
case "get":
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess else { fail(status) }
    guard let data = item as? Data, data.count > 0, data.count <= 16384 else { fail() }
    FileHandle.standardOutput.write(data)
case "delete-test":
    guard args[2] == "test" else { fail() }
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess else { fail(status) }
default: fail()
}
