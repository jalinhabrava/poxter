export const LIST_CHANNELS_QUERY = 'query ListChannels { channels { id name } }';
export const CREATE_POST_MUTATION = 'mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { post { id status scheduledAt } } }';
export const DELETE_POST_MUTATION = 'mutation DeletePost($id: ID!) { deletePost(id: $id) { success } }';
