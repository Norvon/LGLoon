/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { Browse } from '../lib/protobuf/response/browse_pb'
import { Next } from '../lib/protobuf/response/next_pb'
import { Search } from '../lib/protobuf/response/search_pb'
import { Shorts } from '../lib/protobuf/response/shorts_pb'
import { Guide } from '../lib/protobuf/response/guide_pb'
import { Player } from '../lib/protobuf/response/player_pb'
import { Watch } from '../lib/protobuf/response/watch_pb'
import { Entity } from '../lib/protobuf/response/frameworkUpdate_pb'

import { YouTubeMessage } from './youtube'
import { restoreSubscriptionsTab } from './guide'
import { $ } from '../lib/env'
import { protoBase64 } from '@bufbuild/protobuf'

export class BrowseMessage extends YouTubeMessage {
  constructor (msgType: any = Browse, name: string = 'Browse') {
    super(msgType, name)
  }

  pure (): YouTubeMessage {
    this.iterate(this.message, 'sectionListSupportedRenderers', (obj) => {
      for (let i = obj.sectionListSupportedRenderers.length - 1; i >= 0; i--) {
        this.removeCommonAD(obj, i)
        this.removeShorts(obj, i)
      }
    })
    return this
  }

  removeCommonAD (obj: any, index: number): void {
    const content = obj.sectionListSupportedRenderers[index]
    const richItemContent = content?.itemSectionRenderer?.richItemContent
    for (let j = richItemContent?.length - 1; j >= 0; j--) {
      if (this.isAdvertise(richItemContent[j])) {
        richItemContent.splice(j, 1)
        this.needProcess = true
      }
    }
  }

  removeShorts (obj: any, index: number): void {
    const shelfRenderer = obj.sectionListSupportedRenderers[index]?.shelfRenderer
    if (this.isShorts(shelfRenderer)) {
      obj.sectionListSupportedRenderers.splice(index, 1)
      this.needProcess = true
    }
  }

  removeFrameworkUpdateAd (): void {
    const mutations = this.message?.frameworkUpdateTransport?.entityBatchUpdate?.mutations
    if (!mutations) return

    for (let j = mutations.length - 1; j >= 0; j--) {
      const mutation = mutations[j]
      const entity = Entity.fromBinary(protoBase64.dec(decodeURIComponent(mutation.entityKey)))
      let adFlag = this.blackEml.includes(entity.name)
      if (!adFlag && this.checkUnknownFiled(mutation?.payload)) {
        adFlag = true
        this.blackEml.push(entity.name)
        this.needSave = true
      }
      if (adFlag) {
        mutations.splice(j, 1)
        this.needProcess = true
      }
    }
  }
}

export class NextMessage extends BrowseMessage {
  constructor (msgType: any = Next, name: string = 'Next') {
    super(msgType, name)
  }
}

export class PlayerMessage extends YouTubeMessage {
  constructor (msgType: any = Player, name: string = 'Player') {
    super(msgType, name)
  }

  pure (): YouTubeMessage {
    // 去除广告
    if (this.message.adPlacements?.length) {
      this.message.adPlacements.length = 0
    }
    if (this.message.adSlots?.length) {
      this.message.adSlots.length = 0
    }
    // 去除广告追踪
    delete this.message?.playbackTracking?.pageadViewthroughconversion
    this.needProcess = true
    return this
  }

}

export class SearchMessage extends BrowseMessage {
  constructor (msgType: any = Search, name: string = 'Search') {
    super(msgType, name)
  }
}

export class ShortsMessage extends YouTubeMessage {
  constructor (msgType: any = Shorts, name: string = 'Shorts') {
    super(msgType, name)
  }

  pure (): YouTubeMessage {
    const shortsRawLength = this.message.entries?.length
    if (shortsRawLength) {
      for (let i = shortsRawLength - 1; i >= 0; i--) {
        if (!this.message.entries[i].command?.reelWatchEndpoint?.overlay) {
          this.message.entries.splice(i, 1)
          this.needProcess = true
        }
      }
    }
    return this
  }
}

export class GuideMessage extends YouTubeMessage {
  constructor (msgType: any = Guide, name: string = 'Guide') {
    super(msgType, name)
  }

  pure (): YouTubeMessage {
    const blackList = ['SPunlimited']
    if (this.argument.blockUpload) blackList.push('FEuploads')
    if (this.argument.blockImmersive) blackList.push('FEmusic_immersive')
    if (this.argument.blockShorts) blackList.push('FEshorts')
    this.iterate(this.message, 'rendererItems', (obj) => {
      if (this.argument.restoreSubscriptions) {
        const restored = restoreSubscriptionsTab(obj.rendererItems)
        if (restored) this.needProcess = true
        $.debug(`Restore subscriptions: ${restored ? 'added' : 'unchanged (already present or unrecognized layout)'}`)
      }
      for (let i = obj.rendererItems.length - 1; i >= 0; i--) {
        const browseId =
          obj.rendererItems[i]?.iconRender?.browseId ||
          obj.rendererItems[i]?.labelRender?.browseId
        if (blackList.includes(browseId)) {
          obj.rendererItems.splice(i, 1)
          this.needProcess = true
        }
      }
    })
    return this
  }
}

export class WatchMessage extends YouTubeMessage {
  player: PlayerMessage
  next: NextMessage

  constructor (msgType: any = Watch, name: string = 'Watch') {
    super(msgType, name)
    this.player = new PlayerMessage()
    this.next = new NextMessage()
  }

  async pure (): Promise<YouTubeMessage> {
    for (const msg of this.message.contents) {
      if (msg.player) {
        this.player.message = msg.player
        await this.player.pure()
      }
      if (msg.next) {
        this.next.message = msg.next
        await this.next.pure()
      }
      this.needProcess = true
    }
    return this
  }
}
