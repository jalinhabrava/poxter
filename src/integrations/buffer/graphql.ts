export const ACCOUNT_ORGANIZATIONS_QUERY = `
query AccountOrganizations {
  account {
    organizations {
      id
      name
    }
  }
}
`;

export const LIST_CHANNELS_QUERY = `
query ListChannels($organizationId: OrganizationId!) {
  channels(input: { organizationId: $organizationId }) {
    id
    name
    service
  }
}
`;

export const CREATE_POST_MUTATION = `
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post {
        id
        status
        dueAt
      }
    }
    ... on MutationError {
      message
    }
  }
}
`;

export const DELETE_POST_MUTATION = `
mutation DeletePost($input: DeletePostInput!) {
  deletePost(input: $input) {
    ... on DeletePostSuccess {
      postId
    }
    ... on VoidMutationError {
      message
    }
    ... on MutationError {
      message
    }
  }
}
`;
