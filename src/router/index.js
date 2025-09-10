import { createRouter, createWebHistory } from 'vue-router'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import Home from '../pages/Home.vue'
import Recipes from '../pages/Recipes.vue'
import Planner from '../pages/Planner.vue'
import Learn from '../pages/Learn.vue'
import Login from '../pages/Login.vue'
import Register from '@/pages/Register.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home
  },
  {
    path: '/recipes',
    name: 'recipes',
    component: Recipes,
    meta: { requiresAuth: true } 
  },
  {
    path: '/planner',
    name: 'planner',
    component: Planner,
    meta: { requiresAuth: true }
  },
  {
    path: '/learn',
    name: 'learn',
    component: Learn,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',    
    component: Login
  },
  {
    path: '/register',
    name: 'register',  
    component: Register
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const removeListener = onAuthStateChanged(
      getAuth(),
      (user) => {
        removeListener()
        resolve(user)
      },
      reject
    )
  })
}

router.beforeEach(async (to, from, next) => {
  const user = await getCurrentUser()
  
  console.log('Navigation guard:', { 
    to: to.name, 
    user: user?.email,
    requiresAuth: to.meta.requiresAuth 
  })

  if (to.name === 'home' || to.name === 'login' || to.name === 'register') {
    next()
    return
  }

  
  if (to.meta.requiresAuth) {
    if (!user) {
      console.log('Unauthorized access, redirecting to login')
      next({ name: 'login' })
      return
    }
    const isAdmin = user.email === 'admin@gmail.com'
    
    if (isAdmin) {
      // admin can access all pages
      console.log('Admin access granted')
      next()
    } else if (['recipes', 'planner', 'learn'].includes(to.name)) {
      // regular user can access these pages
      console.log('User access granted')
      next()
    } else {
      console.log('Access denied, redirecting to home')
      next({ name: 'home' })
    }
  } else {
    next()
  }
})

export default router