import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './firebase/index.js'
// Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';

import PrimeVue from 'primevue/config'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'

import 'primevue/resources/themes/lara-light-blue/theme.css'
import 'primevue/resources/primevue.min.css'
import 'primeicons/primeicons.css'


const app = createApp(App)
app.use(router)
app.use(PrimeVue, { ripple: true })
app.component('DataTable', DataTable)
app.component('Column', Column)
app.component('Dropdown', Dropdown)
app.component('InputText', InputText)
app.mount('#app')

