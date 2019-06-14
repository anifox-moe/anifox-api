<h1 align="center">Anifox-api</h1>

<p align="center">
  A really shitty REST API for Anifox.moe
</p>

<p align="center">
  <a href="https://standardjs.com/" target="_blank">
    <img src="https://cdn.rawgit.com/feross/standard/master/badge.svg" />
  </a>
</p>

## Getting Started
These Instructions will tell you how to run this on your local machine\
### Prerequisites :bulb:
- This repo uses node-gyp as a dependency
Please find out how to install this on your OS at\
https://github.com/nodejs/node-gyp
- Obviously a running database is needed too, this project currently uses node-mysql running on localhost

### Installing
Run these commands in the project directory,
Must install submodules before proceeding
```
git submodule init 
git submodule update
```
Then
```
npm install & npm run postinstall <<This will install submodules dependencies
```
Or if you a yarn person
```
yarn & yarn run postinstall <<This will install submodules dependencies
```
### Running
Use
```
yarn run start || npm run start
```
### License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE) file for details
### Acknowledgments
[@Kylart]: /url "title"
Thanks to 
[@Kylart]
For making some useful scraper's for searching Nyaa and MAL
- [Nyaapi](https://github.com/Kylart/Nyaapi)
- [MalScraper](https://github.com/Kylart/MalScraper)
