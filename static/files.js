const getFileModal = function (elem, fileId) {
    if (!fileId) {
        fileId = $(elem).attr('file-id');
    }

    const modalExists = $(document).find(`#button-${fileId}`).length > 0;

    if (modalExists) {
        $(`#modal-${fileId}`).remove();
        $(`#button-${fileId}`).remove();
    }


    $.ajax({
        url: `/getFileModal/${fileId}`,
        type: 'GET',
        contentType: 'application/json',
        success: function (response) {
            $('footer').before(response);
            $(`#button-${fileId}`).trigger('click');
        },
        error: function (xhr, status, error) {
            alert(xhr.responseText);
        },
    });
};

const getFileDetails = function (elem) {
    const fileId = $(elem).attr('file-id');
    $.ajax({
        url: `/file/${fileId}`,
        method: 'GET',
        success: (response) => {
            $('#file-container').html(response);
        },
        error: (error) => {
            alert(error);
        },
    });
};
