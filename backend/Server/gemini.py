import os
import google.generativeai as genai  # type: ignore
from PIL import Image

# Configure Gemini API
GEMINI_API_KEY = "AIzaSyBa-JOoiZMW4swlMZWTbKUcsxGQU1PXabk"
genai.configure(api_key=GEMINI_API_KEY)  # type: ignore

# Initialize the Gemini model
model = genai.GenerativeModel('gemini-2.5-flash')  # type: ignore

def get_images_from_folder(folder_path):
    """
    Fetch all image files from the specified folder.
    Supports: jpg, jpeg, png, gif, bmp, webp
    """
    supported_formats = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    images = []

    if not os.path.exists(folder_path):
        print(f"Warning: Folder '{folder_path}' does not exist.")
        return images

    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)
        if os.path.isfile(file_path):
            _, ext = os.path.splitext(filename)
            if ext.lower() in supported_formats:
                images.append(file_path)

    return images

def describe_image(image_path):
    """
    Generate a 2-3 line description of an image using Gemini API.
    """
    try:
        # Open and load the image
        img = Image.open(image_path)

        # Create prompt for concise description
        prompt = "Describe this image in 2-3 concise sentences. Focus on the main subject, key details, and overall context."

        # Generate description
        response = model.generate_content([prompt, img])

        return response.text.strip()

    except Exception as e:
        return f"Error processing image: {str(e)}"

def delete_image(image_path):
    """
    Delete an image file from the filesystem.

    Args:
        image_path: Path to the image file to delete

    Returns:
        bool: True if deletion was successful, False otherwise
    """
    try:
        if os.path.exists(image_path):
            os.remove(image_path)
            print(f"Deleted: {os.path.basename(image_path)}")
            return True
        else:
            print(f"Warning: Image not found at {image_path}")
            return False
    except Exception as e:
        print(f"Error deleting image {image_path}: {str(e)}")
        return False

def describe_all_images(folder_path, delete_after_processing=False):
    """
    Process all images in the folder and return descriptions.

    Args:
        folder_path: Path to the folder containing images
        delete_after_processing: If True, delete images after getting descriptions

    Returns:
        dict: Dictionary mapping filenames to their descriptions
    """
    images = get_images_from_folder(folder_path)

    if not images:
        print(f"No images found in '{folder_path}'")
        return {}

    descriptions = {}

    for image_path in images:
        filename = os.path.basename(image_path)
        print(f"Processing: {filename}")
        description = describe_image(image_path)
        descriptions[filename] = description
        print(f"Description: {description}\n")

        # Delete the image after getting description if requested
        if delete_after_processing:
            delete_image(image_path)

    return descriptions

def main():
    """
    Main function to process images from the backend/images folder.
    """
    # Get the backend folder path (parent of Server folder)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    images_folder = os.path.join(backend_dir, 'images')

    print(f"Looking for images in: {images_folder}\n")

    # Create images folder if it doesn't exist
    if not os.path.exists(images_folder):
        os.makedirs(images_folder)
        print(f"Created images folder at: {images_folder}")
        print("Please add some images to this folder and run the script again.")
        return

    # Process all images and delete them after processing
    descriptions = describe_all_images(images_folder, delete_after_processing=True)

    if descriptions:
        print(f"\n{'='*50}")
        print(f"Successfully processed {len(descriptions)} image(s)")
        print(f"{'='*50}")

    return descriptions

if __name__ == "__main__":
    main()
