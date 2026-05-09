
/*import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/graphql/v1`,
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  }),
  cache: new InMemoryCache(),
})*/
// Apollo Client skipped due to Next.js App Router compatibility
// Would use @apollo/experimental-nextjs-app-support in production
// Using Supabase Client for all data fetching instead

export {}