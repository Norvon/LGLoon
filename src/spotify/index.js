import { disablePlaybackAds } from './playback-ads.js'

const url = $request.url
const adRequest = /^https:\/\/(?:\w+-spclient|spclient\.wg)\.spotify\.com(?::443)?\/pendragon\//
const artistRequest = /^https:\/\/(?:\w+-spclient|spclient\.wg)\.spotify\.com(?::443)?(\/artistview\/v1\/artist\/[^?#]+\?(?:[^#]*&)?platform=)iphone(?=[&#]|$)/

if (typeof $response !== 'undefined') {
  $done(disablePlaybackAds(url, $response))
} else if (adRequest.test(url)) {
  $done({ response: { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{}' } })
} else if (artistRequest.test(url)) {
  // 沿用原复写的 iPad 歌手列表视图，保留匹配范围之外的查询参数。
  $done({ url: url.replace(artistRequest, 'https://spclient.wg.spotify.com$1ipad') })
} else {
  $done({})
}
