import { proto2, ScalarType } from '@bufbuild/protobuf'

// 只声明广告字段和外层结构，Protobuf 会保留其余字段。proto2 会把 false 显式写回。
const AccountAttribute = proto2.makeMessageType('spotify.AccountAttribute', [
  { no: 2, name: 'bool_value', kind: 'scalar', T: ScalarType.BOOL, opt: true },
])

const AccountAttributeEntry = proto2.makeMessageType('spotify.AccountAttributeEntry', [
  { no: 1, name: 'key', kind: 'scalar', T: ScalarType.STRING, opt: true },
  { no: 2, name: 'value', kind: 'message', T: AccountAttribute },
])

const AccountAttributes = proto2.makeMessageType('spotify.AccountAttributes', [
  { no: 1, name: 'entries', kind: 'message', T: AccountAttributeEntry, repeated: true },
])

const CustomizationSuccess = proto2.makeMessageType('spotify.CustomizationSuccess', [
  { no: 3, name: 'account_attributes', kind: 'message', T: AccountAttributes },
])

const CustomizationResponse = proto2.makeMessageType('spotify.CustomizationResponse', [
  { no: 1, name: 'success', kind: 'message', T: CustomizationSuccess },
])

const BootstrapSuccess = proto2.makeMessageType('spotify.BootstrapSuccess', [
  { no: 1, name: 'customization', kind: 'message', T: CustomizationResponse },
])

const BootstrapCustomization = proto2.makeMessageType('spotify.BootstrapCustomization', [
  { no: 1, name: 'success', kind: 'message', T: BootstrapSuccess },
])

const BootstrapResponse = proto2.makeMessageType('spotify.BootstrapResponse', [
  { no: 2, name: 'user_customization', kind: 'message', T: BootstrapCustomization },
])

export function disablePlaybackAds(url, { status, body }) {
  if (status !== 200 || !(body instanceof Uint8Array)) return {}

  const path = url.split(/[?#]/, 1)[0]
  const isBootstrap = path.endsWith('/bootstrap/v1/bootstrap')
  if (!isBootstrap && !path.endsWith('/user-customization-service/v1/customize')) return {}

  try {
    const message = (isBootstrap ? BootstrapResponse : CustomizationResponse).fromBinary(body)
    const customization = isBootstrap ? message.userCustomization?.success?.customization : message
    const entries = customization?.success?.accountAttributes?.entries
    if (!entries) return {}

    // map 中同名 key 以最后一条为准。
    const ads = entries.filter(entry => entry.key === 'ads').pop()
    if (ads?.value?.boolValue === false) return {}

    const value = new AccountAttribute({ boolValue: false })
    if (ads) {
      ads.value = value
    } else {
      entries.push(new AccountAttributeEntry({ key: 'ads', value }))
    }
    return { body: message.toBinary() }
  } catch {
    return {}
  }
}
