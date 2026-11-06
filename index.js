import express from 'express'
import path from 'path'

const app = express();
const publicPath = path.resolve('public')
app.use(express.static(publicPath))

app.set('view engine', 'ejs')

app.get('/', (req, resp) => {
    resp.render('list')
})

app.get('/add', (req, resp) => {
    resp.render('add')
})

app.get('/update', (req, resp) => {
    resp.render('update')
})

app.listen(3200, () => {
    console.log('Server is running on port 3200')
})