<?php
// upload.php

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['image'])) {
    $image = $_FILES['image'];

    // API endpoint for Postimages image upload
    $url = "https://api.postimages.org/upload";

    // Prepare cURL for uploading the image
    $ch = curl_init();
    $data = array(
        'image' => new CURLFile($image['tmp_name'], $image['type'], $image['name']),
    );

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    // Get the response
    $response = curl_exec($ch);

    // Handle errors
    if(curl_errno($ch)) {
        echo json_encode([
            'success' => false,
            'message' => 'Error uploading the image.',
            'error' => curl_error($ch),
        ]);
    } else {
        // Parse the response
        $response_data = json_decode($response, true);
        if (isset($response_data['url'])) {
            echo json_encode([
                'success' => true,
                'imageUrl' => $response_data['url']
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Error in API response',
                'error' => $response,
            ]);
        }
    }

    curl_close($ch);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'No image file received.'
    ]);
}
?>
