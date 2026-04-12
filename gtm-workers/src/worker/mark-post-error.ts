import { PostRepository } from "../storage/repositories/post-repository.js";

/**
 * Helper to mark a post as error in the database.
 */
export async function markPostError(
  postId: string,
  errorMessage: string,
  postRepository: PostRepository
): Promise<void> {
  try {
    await postRepository.markError(postId, errorMessage);
  } catch (err) {
    console.error(`Critial error: failed to mark post ${postId} as error:`, err);
  }
}
