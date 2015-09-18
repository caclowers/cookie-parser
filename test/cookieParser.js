
var assert = require('assert')
var cookieParser = require('..')
var http = require('http')
var request = require('supertest')
var signature = require('cookie-signature')

describe('cookieParser()', function(){
  var server
  before(function(){
    server = createServer('keyboard cat')
  })

  it('should export JSONCookies function', function(){
    assert(typeof cookieParser.JSONCookies, 'function')
  })

  it('should export signedCookies function', function(){
    assert(typeof cookieParser.signedCookies, 'function')
  })

  describe('when no cookies are sent', function(){
    it('should default req.cookies to {}', function(done){
      request(server)
      .get('/')
      .expect(200, '{}', done)
    })

    it('should default req.signedCookies to {}', function(done){
      request(server)
      .get('/signed')
      .expect(200, '{}', done)
    })
  })

  describe('when cookies are sent', function(){
    it('should populate req.cookies', function(done){
      request(server)
      .get('/')
      .set('Cookie', 'foo=bar; bar=baz')
      .expect(200, '{"foo":"bar","bar":"baz"}', done)
    })

    it('should inflate JSON cookies', function(done){
      request(server)
      .get('/')
      .set('Cookie', 'foo=j:{"foo":"bar"}')
      .expect(200, '{"foo":{"foo":"bar"}}', done)
    })

    it('should not inflate invalid JSON cookies', function(done){
      request(server)
      .get('/')
      .set('Cookie', 'foo=j:{"foo":')
      .expect(200, '{"foo":"j:{\\"foo\\":"}', done)
    })
  })

  describe('when a secret is given', function(){
    var val = signature.sign('foobarbaz', 'keyboard cat');
    // TODO: "bar" fails...

    it('should populate req.signedCookies', function(done){
      request(server)
      .get('/signed')
      .set('Cookie', 'foo=s:' + val)
      .expect(200, '{"foo":"foobarbaz"}', done)
    })

    it('should remove the signed value from req.cookies', function(done){
      request(server)
      .get('/')
      .set('Cookie', 'foo=s:' + val)
      .expect(200, '{}', done)
    })

    it('should omit invalid signatures', function(done){
      server.listen()
      request(server)
      .get('/signed')
      .set('Cookie', 'foo=' + val + '3')
      .expect(200, '{}', function(err){
        if (err) return done(err)
        request(server)
        .get('/')
        .set('Cookie', 'foo=' + val + '3')
        .expect(200, '{"foo":"foobarbaz.CP7AWaXDfAKIRfH49dQzKJx7sKzzSoPq7/AcBBRVwlI3"}', done)
      });
    })
  })

  describe('when no secret is given', function () {
    var server
    before(function () {
      server = createServer()
    })

    it('should populate req.cookies', function (done) {
      request(server)
      .get('/')
      .set('Cookie', 'foo=bar; bar=baz')
      .expect(200, '{"foo":"bar","bar":"baz"}', done)
    })

    it('should not populate req.signedCookies', function (done) {
      var val = signature.sign('foobarbaz', 'keyboard cat');
      request(server)
      .get('/signed')
      .set('Cookie', 'foo=s:' + val)
      .expect(200, '{}', done)
    })
  })
})

describe('cookieParser.JSONCookie(str)', function () {
  it('should return undefined for non-string arguments', function () {
    assert.strictEqual(cookieParser.JSONCookie(), undefined)
    assert.strictEqual(cookieParser.JSONCookie(undefined), undefined)
    assert.strictEqual(cookieParser.JSONCookie(null), undefined)
    assert.strictEqual(cookieParser.JSONCookie(42), undefined)
    assert.strictEqual(cookieParser.JSONCookie({}), undefined)
    assert.strictEqual(cookieParser.JSONCookie([]), undefined)
    assert.strictEqual(cookieParser.JSONCookie(function(){}), undefined)
  })

  it('should return undefined for non-JSON cookie string', function () {
    assert.strictEqual(cookieParser.JSONCookie(''), undefined)
    assert.strictEqual(cookieParser.JSONCookie('foo'), undefined)
    assert.strictEqual(cookieParser.JSONCookie('{}'), undefined)
  })

  it('should return object for JSON cookie string', function () {
    assert.deepEqual(cookieParser.JSONCookie('j:{"foo":"bar"}'), { foo: 'bar' })
  })

  it('should return undefined on invalid JSON', function () {
    assert.strictEqual(cookieParser.JSONCookie('j:{foo:"bar"}'), undefined)
  })
})

describe('cookieParser.signedCookie(str, secret)', function () {
  it('should pass through non-signed string', function () {
    assert.strictEqual(cookieParser.signedCookie('', 'keyboard cat'), '')
    assert.strictEqual(cookieParser.signedCookie('foo', 'keyboard cat'), 'foo')
    assert.strictEqual(cookieParser.signedCookie('j:{}', 'keyboard cat'), 'j:{}')
  })

  it('should return false for tampered signed string', function () {
    assert.strictEqual(cookieParser.signedCookie('s:foobaz.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE', 'keyboard cat'), false)
  })

  it('should return unsigned value for signed string', function () {
    assert.strictEqual(cookieParser.signedCookie('s:foobar.N5r0C3M8W+IPpzyAJaIddMWbTGfDSO+bfKlZErJ+MeE', 'keyboard cat'), 'foobar')
  })
})

function createServer(secret) {
  var _parser = cookieParser(secret)
  return http.createServer(function(req, res){
    _parser(req, res, function(err){
      if (err) {
        res.statusCode = 500
        res.end(err.message)
        return
      }

      var cookies = '/signed' === req.url
        ? req.signedCookies
        : req.cookies
      res.end(JSON.stringify(cookies))
    })
  })
}
