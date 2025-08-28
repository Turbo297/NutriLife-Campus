import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'
import Recipes from '../pages/Recipes.vue'
import Planner from '../pages/Planner.vue'
import Learn from '../pages/Learn.vue'
import Login from '../pages/Login.vue'
const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/recipes',
    name: 'recipes',
    component: Recipes
  },
  {
    path: '/planner',
    name: 'planner',
    component: Planner
  },
  {
    path: '/learn',
    name: 'learn',
    component: Learn
  },
  {
    path: '/login',
    name: 'login',    
    component: Login
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router