import { proto2, ScalarType } from '@bufbuild/protobuf'

// 只声明需要处理的字段，让 Protobuf 保留其余数据并显式写回 false 和空字符串。
const AccountAttribute = proto2.makeMessageType('spotify.AccountAttribute', [
  { no: 2, name: 'bool_value', kind: 'scalar', T: ScalarType.BOOL, opt: true },
  { no: 4, name: 'string_value', kind: 'scalar', T: ScalarType.STRING, opt: true },
])

const AccountAttributeEntry = proto2.makeMessageType('spotify.AccountAttributeEntry', [
  { no: 1, name: 'key', kind: 'scalar', T: ScalarType.STRING, opt: true },
  { no: 2, name: 'value', kind: 'message', T: AccountAttribute },
])

const AccountAttributes = proto2.makeMessageType('spotify.AccountAttributes', [
  { no: 1, name: 'entries', kind: 'message', T: AccountAttributeEntry, repeated: true },
])

const PropertyId = proto2.makeMessageType('spotify.PropertyId', [
  { no: 1, name: 'scope', kind: 'scalar', T: ScalarType.STRING, opt: true },
  { no: 2, name: 'name', kind: 'scalar', T: ScalarType.STRING, opt: true },
])

const BoolValue = proto2.makeMessageType('spotify.BoolValue', [
  { no: 1, name: 'value', kind: 'scalar', T: ScalarType.BOOL, opt: true },
])

const EnumValue = proto2.makeMessageType('spotify.EnumValue', [
  { no: 1, name: 'value', kind: 'scalar', T: ScalarType.STRING, opt: true },
])

const AssignedValue = proto2.makeMessageType('spotify.AssignedValue', [
  { no: 1, name: 'property_id', kind: 'message', T: PropertyId, opt: true },
  { no: 3, name: 'bool_value', kind: 'message', T: BoolValue, opt: true },
  { no: 5, name: 'enum_value', kind: 'message', T: EnumValue, opt: true },
])

const Configuration = proto2.makeMessageType('spotify.Configuration', [
  { no: 3, name: 'assigned_values', kind: 'message', T: AssignedValue, repeated: true },
])

const ResolveSuccess = proto2.makeMessageType('spotify.ResolveSuccess', [
  { no: 1, name: 'configuration', kind: 'message', T: Configuration, opt: true },
])

const CustomizationSuccess = proto2.makeMessageType('spotify.CustomizationSuccess', [
  { no: 1, name: 'resolve_success', kind: 'message', T: ResolveSuccess, opt: true },
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

const accountOverrides = {
  ads: { boolValue: false },
  'com.spotify.madprops.use.ucs.product.state': { boolValue: true },
  'nft-disabled': { stringValue: '1' },
  offline: { boolValue: true },
  'player-license': { stringValue: 'premium' },
  'streaming-rules': { stringValue: '' },
  type: { stringValue: 'premium' },
  'publish-playlist': { boolValue: false },
  name: { stringValue: 'Spotify Premium' },
  'financial-product': { stringValue: 'pr:premium,tc:0' },
}

export function rewriteSpotifyConfiguration(url, { status, body }, { tab = false, useractivity = true }) {
  if (status !== 200 || !(body instanceof Uint8Array)) return {}

  const service = /^https:\/\/[^/]+\/(bootstrap|user-customization-service)/i.exec(url)?.[1]
  if (!service) return {}
  const isBootstrap = service.toLowerCase() === 'bootstrap'

  try {
    const message = (isBootstrap ? BootstrapResponse : CustomizationResponse).fromBinary(body)
    const customization = isBootstrap ? message.userCustomization?.success?.customization : message
    const success = customization?.success
    const entries = success?.accountAttributes?.entries
    if (!entries) return {}

    // map 中同名 key 以最后一条为准。
    const byKey = new Map(entries.map(entry => [entry.key, entry]))
    for (const [key, fields] of Object.entries(accountOverrides)) {
      const value = new AccountAttribute(fields)
      const entry = byKey.get(key)
      if (entry) {
        entry.value = value
      } else {
        entries.push(new AccountAttributeEntry({ key, value }))
      }
    }

    const assignedValues = success.resolveSuccess?.configuration?.assignedValues ?? []
    for (const { propertyId, boolValue, enumValue } of assignedValues) {
      const { scope, name } = propertyId ?? {}
      if (scope === 'ios-system-your-plan-sidedrawer' && name === 'is_row_enabled' && boolValue) {
        boolValue.value = false
      } else if (tab && scope === 'ios-feature-navigation' && name === 'tab_configuration' && enumValue) {
        enumValue.value = ''
      } else if (!useractivity && scope === 'ios-feature-share' && name === 'is_useractivity_sharing_enabled' && boolValue) {
        boolValue.value = false
      }
    }
    return { body: message.toBinary() }
  } catch {
    return {}
  }
}
